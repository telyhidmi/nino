import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real adapters/controller without loading native Expo modules.
// Only UI imports are stubbed; no production permission logic is replaced.
function loadTs(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: (name) => name === 'react-native' ? { StyleSheet: { create: (value) => value } } : {},
  });
  return exports;
}
const {
  LocationGateController, createNativeLocationAdapter, createWebLocationAdapter, locationGateAllowsAccess, locationGateKeepsRoutesMounted,
} = loadTs('../components/RequiredLocationGate.tsx');
const { locationGateCopies } = loadTs('../lib/locationGateCopy.ts');

const value = (status, canAskAgain = false) => ({ status, canAskAgain });
const deferred = () => {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
function controllerHarness(initial = value('prompt', true)) {
  let checked = initial;
  let listener;
  let requests = 0;
  let checks = 0;
  let stops = 0;
  const changes = [];
  const adapter = {
    check: async () => { checks++; return await checked; },
    request: async () => { requests++; return await checked; },
    subscribe: (callback) => { listener = callback; return () => { listener = undefined; }; },
    setForeground: () => {},
    dispose: () => {},
  };
  const gate = new LocationGateController(adapter, (state) => changes.push(state.status), () => { stops++; });
  return {
    gate, changes,
    setCheck: (next) => { checked = next; },
    emit: (next) => listener?.(next),
    counts: () => ({ requests, checks, stops }),
  };
}
function nativeHarness(permission = { status: 'undetermined', granted: false, canAskAgain: true }, services = true) {
  let requests = 0;
  let response = { status: 'granted', granted: true, canAskAgain: true };
  const api = {
    getForegroundPermissionsAsync: async () => permission,
    requestForegroundPermissionsAsync: async () => { requests++; return response; },
    hasServicesEnabledAsync: async () => services,
  };
  return {
    adapter: createNativeLocationAdapter(api),
    requests: () => requests,
    setPermission: (next) => { permission = next; },
    setResponse: (next) => { response = next; },
  };
}
function browserHarness({ permissionState = 'prompt', queryUnsupported = false, secure = true, noGeo = false } = {}) {
  let listener;
  let success;
  let failure;
  let watchFailure;
  let queries = 0;
  let positions = 0;
  let watches = 0;
  const cleared = [];
  const permission = {
    state: permissionState,
    addEventListener: (_name, callback) => { listener = callback; },
    removeEventListener: (_name, callback) => { if (listener === callback) listener = undefined; },
  };
  const geolocation = {
    getCurrentPosition: (ok, fail, options) => {
      assert.equal(options.enableHighAccuracy, false);
      assert.equal(options.maximumAge, 0);
      assert.equal(options.timeout, 12000);
      positions++; success = ok; failure = fail;
    },
    watchPosition: (_ok, fail) => { watches++; watchFailure = fail; return 42; },
    clearWatch: (id) => { cleared.push(id); },
  };
  const adapter = createWebLocationAdapter({
    isSecureContext: secure,
    navigator: {
      geolocation: noGeo ? undefined : geolocation,
      permissions: { query: async () => { queries++; if (queryUnsupported) throw new Error('Not implemented'); return permission; } },
    },
  });
  return {
    adapter,
    change: (next) => { permission.state = next; listener?.(); },
    grant: () => success?.({ get coords() { throw new Error('Coordinates must never be accessed'); } }),
    fail: (code) => failure?.({ code }),
    revokeWatch: () => watchFailure?.({ code: 1 }),
    counts: () => ({ queries, positions, watches, cleared }),
  };
}

test('only explicitly granted permits visible/interactive access, including demo and deep-linked routes', () => {
  for (const status of ['checking', 'requesting', 'prompt', 'denied', 'unsupported', 'error', 'servicesDisabled']) {
    assert.equal(locationGateAllowsAccess(value(status)), false, status);
  }
  assert.equal(locationGateAllowsAccess(value('granted')), true);
  assert.equal(locationGateKeepsRoutesMounted(value('checking')), false, 'first entry never mounts routes while checking');
  assert.equal(locationGateKeepsRoutesMounted(value('requesting')), false, 'first request never mounts routes');
  assert.equal(locationGateKeepsRoutesMounted({ ...value('checking'), retainRoutes: true }), true);
  assert.equal(locationGateAllowsAccess({ ...value('checking'), retainRoutes: true }), false, 'retained routes are not access');
  for (const status of ['denied', 'prompt', 'error', 'unsupported', 'servicesDisabled']) {
    assert.equal(locationGateKeepsRoutesMounted({ ...value(status), retainRoutes: true }), false, status);
  }
  const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /<RequiredLocationGate>\s*<ClerkLoaded>\s*<RootNav/);
  assert.match(layout, /<RequiredLocationGate>\s*<MissingAuthConfig/);
  assert.doesNotMatch(layout, /signOut|closeActiveLiveSession/);
});

test('initial check and repeated retries do not automatically request permission', async () => {
  const h = controllerHarness(value('denied'));
  assert.equal(h.gate.current.status, 'checking');
  await h.gate.refresh();
  await h.gate.refresh();
  assert.equal(h.gate.current.status, 'denied');
  assert.deepEqual(h.counts(), { requests: 0, checks: 2, stops: 0 });
  h.gate.dispose();
});

test('revocation locks routes and calls media cleanup exactly once for an access loss', async () => {
  const h = controllerHarness(value('granted'));
  await h.gate.refresh();
  h.emit(value('denied'));
  assert.equal(h.gate.current.status, 'denied');
  assert.equal(h.counts().stops, 1);
  h.emit(value('prompt', true));
  assert.equal(h.counts().stops, 1);
  h.gate.dispose();
});

test('a late grant cannot override a newer revocation event', async () => {
  const delayed = deferred();
  const h = controllerHarness(delayed.promise);
  const check = h.gate.refresh();
  h.emit(value('denied'));
  delayed.resolve(value('granted'));
  await check;
  assert.equal(h.gate.current.status, 'denied');
  h.gate.dispose();
});

test('background covers existing routes without teardown; foreground denial then tears them down', async () => {
  const h = controllerHarness(value('granted'));
  await h.gate.refresh();
  const delayed = deferred();
  h.setCheck(delayed.promise);
  const check = h.gate.refresh();
  h.gate.setActive(false);
  assert.equal(h.gate.current.status, 'checking');
  assert.equal(locationGateKeepsRoutesMounted(h.gate.current), true, 'preserve drafts, picker callbacks, and auth state');
  assert.equal(locationGateAllowsAccess(h.gate.current), false);
  assert.equal(h.counts().stops, 0, 'temporary background is not a permission revocation');
  delayed.resolve(value('granted'));
  await check;
  assert.equal(h.gate.current.status, 'checking');
  const foreground = deferred();
  h.setCheck(foreground.promise);
  h.gate.setActive(true);
  assert.equal(locationGateKeepsRoutesMounted(h.gate.current), true);
  assert.equal(locationGateAllowsAccess(h.gate.current), false, 'stale grant never becomes visible on return');
  foreground.resolve(value('denied'));
  await tick();
  assert.equal(h.gate.current.status, 'denied');
  assert.equal(locationGateKeepsRoutesMounted(h.gate.current), false);
  assert.equal(h.counts().stops, 1);
  h.gate.dispose();
});

test('a successful background/system-picker recheck preserves the same authorized route tree', async () => {
  const h = controllerHarness(value('granted'));
  await h.gate.refresh();
  for (let transition = 0; transition < 3; transition++) {
    h.gate.setActive(false);
    assert.equal(locationGateKeepsRoutesMounted(h.gate.current), true);
    assert.equal(locationGateAllowsAccess(h.gate.current), false);
    const check = deferred();
    h.setCheck(check.promise);
    h.gate.setActive(true);
    assert.equal(locationGateKeepsRoutesMounted(h.gate.current), true);
    assert.equal(locationGateAllowsAccess(h.gate.current), false);
    check.resolve(value('granted'));
    await tick();
    assert.equal(locationGateKeepsRoutesMounted(h.gate.current), true);
    assert.equal(locationGateAllowsAccess(h.gate.current), true);
  }
  assert.equal(h.counts().stops, 0, 'camera/live retain their existing background cleanup, not gate teardown');
  h.gate.dispose();
});

test('focus rechecks cover without unmounting, and supersede an old passive poll grant', async () => {
  const h = controllerHarness(value('granted'));
  await h.gate.refresh();
  const oldRead = deferred();
  h.setCheck(oldRead.promise);
  const poll = h.gate.refresh();
  const currentRead = deferred();
  h.setCheck(currentRead.promise);
  const focus = h.gate.refresh(true);
  assert.equal(locationGateAllowsAccess(h.gate.current), false);
  assert.equal(locationGateKeepsRoutesMounted(h.gate.current), true);
  oldRead.resolve(value('granted'));
  await poll;
  assert.equal(locationGateAllowsAccess(h.gate.current), false, 'old grant cannot uncover the app');
  currentRead.resolve(value('granted'));
  await focus;
  assert.equal(locationGateAllowsAccess(h.gate.current), true);
  assert.equal(h.counts().stops, 0);
  h.gate.dispose();
});

test('every definite blocked check unmounts retained routes and stops media even after background', async () => {
  for (const status of ['denied', 'error', 'servicesDisabled', 'unsupported', 'prompt']) {
    const h = controllerHarness(value('granted'));
    await h.gate.refresh();
    h.gate.setActive(false);
    h.setCheck(value(status));
    h.gate.setActive(true);
    await tick();
    assert.equal(locationGateKeepsRoutesMounted(h.gate.current), false, status);
    assert.equal(locationGateAllowsAccess(h.gate.current), false, status);
    assert.equal(h.counts().stops, 1, status);
    h.gate.dispose();
  }
});

test('a first background/resume cycle cannot preserve routes that have never been granted', async () => {
  const h = controllerHarness(value('prompt', true));
  h.gate.setActive(false);
  assert.equal(locationGateKeepsRoutesMounted(h.gate.current), false);
  h.gate.setActive(true);
  await tick();
  assert.equal(locationGateKeepsRoutesMounted(h.gate.current), false);
  assert.equal(h.counts().stops, 0);
  h.gate.dispose();
});

test('double taps, polling, and focus during a request cannot create a prompt loop', async () => {
  const pending = deferred();
  const h = controllerHarness(pending.promise);
  const first = h.gate.request();
  await h.gate.request();
  await h.gate.refresh();
  assert.equal(h.counts().requests, 1);
  assert.equal(h.counts().checks, 0);
  pending.resolve(value('denied'));
  await first;
  await h.gate.refresh();
  assert.equal(h.counts().requests, 1);
  assert.equal(h.gate.current.status, 'denied');
  h.gate.dispose();
});

test('permission check errors are fail closed, not synthetic grants', async () => {
  const h = controllerHarness(Promise.resolve().then(() => { throw new Error('Permission module failed'); }));
  await h.gate.refresh();
  assert.equal(h.gate.current.status, 'error');
  assert.equal(locationGateAllowsAccess(h.gate.current), false);
  h.gate.dispose();
});

test('native grants require matching granted status and enabled location services', async () => {
  for (const permission of [
    { status: 'undetermined', granted: false, canAskAgain: true },
    { status: 'denied', granted: false, canAskAgain: false },
    { status: 'denied', granted: true, canAskAgain: false },
  ]) {
    assert.equal(locationGateAllowsAccess(await nativeHarness(permission).adapter.check()), false);
  }
  const permission = { status: 'granted', granted: true, canAskAgain: true };
  assert.equal((await nativeHarness(permission).adapter.check()).status, 'granted');
  assert.equal((await nativeHarness(permission, false).adapter.check()).status, 'servicesDisabled');
});

test('native permanently denied permission never re-prompts; retryable denial can request once', async () => {
  const denied = { status: 'denied', granted: false, canAskAgain: false };
  const h = nativeHarness(denied);
  assert.equal((await h.adapter.request()).status, 'denied');
  assert.equal(h.requests(), 0);
  h.setPermission({ ...denied, canAskAgain: true });
  assert.equal((await h.adapter.request()).status, 'granted');
  assert.equal(h.requests(), 1);
});

test('web checks are passive, and known denied browser permission never prompts', async () => {
  const h = browserHarness();
  assert.equal((await h.adapter.check()).status, 'prompt');
  assert.equal(h.counts().positions, 0);
  h.change('denied');
  assert.equal((await h.adapter.request()).status, 'denied');
  assert.equal(h.counts().positions, 0);
  h.adapter.dispose();
});

test('insecure and unsupported browsers remain blocked even after retry', async () => {
  for (const options of [{ secure: false }, { noGeo: true }]) {
    const h = browserHarness(options);
    assert.equal((await h.adapter.check()).status, 'unsupported');
    assert.equal((await h.adapter.request()).status, 'unsupported');
    assert.equal(h.counts().positions, 0);
    h.adapter.dispose();
  }
});

test('browser Permissions change events immediately lock a mounted app', async () => {
  const h = browserHarness({ permissionState: 'granted' });
  let stopped = 0;
  const gate = new LocationGateController(h.adapter, () => {}, () => { stopped++; });
  await gate.refresh();
  assert.equal(gate.current.status, 'granted');
  h.change('denied');
  assert.equal(gate.current.status, 'denied');
  assert.equal(stopped, 1);
  assert.equal(h.counts().positions, 0);
  assert.equal(h.counts().watches, 0, 'do not start an unnecessary geolocation watch when permission events exist');
  gate.dispose();
});

test('browser denial in background unmounts retained routes; background grants never uncover them', async () => {
  const h = browserHarness({ permissionState: 'granted' });
  let stopped = 0;
  const gate = new LocationGateController(h.adapter, () => {}, () => { stopped++; });
  await gate.refresh();
  gate.setActive(false);
  assert.equal(locationGateKeepsRoutesMounted(gate.current), true);
  h.change('denied');
  assert.equal(gate.current.status, 'denied');
  assert.equal(locationGateKeepsRoutesMounted(gate.current), false);
  assert.equal(stopped, 1);
  h.change('granted');
  assert.equal(gate.current.status, 'denied');
  assert.equal(locationGateAllowsAccess(gate.current), false);
  gate.dispose();
});

test('an explicit browser request uses real geolocation without reading coordinates', async () => {
  const h = browserHarness({ queryUnsupported: true });
  assert.equal((await h.adapter.check()).status, 'prompt');
  const request = h.adapter.request();
  await tick();
  assert.equal(h.counts().positions, 1);
  h.grant();
  assert.equal((await request).status, 'granted');
  assert.equal((await h.adapter.check()).status, 'granted');
  h.adapter.dispose();
});

test('browser geolocation denial and timeouts never unlock the app', async () => {
  for (const code of [1, 2, 3]) {
    const h = browserHarness({ queryUnsupported: true });
    const request = h.adapter.request();
    await tick();
    h.fail(code);
    const result = await request;
    assert.equal(result.status, code === 1 ? 'denied' : 'error');
    assert.equal(locationGateAllowsAccess(result), false);
    h.adapter.dispose();
  }
});

test('fallback browser watcher detects denial and is cleared when access is lost', async () => {
  const h = browserHarness({ queryUnsupported: true });
  let stopped = 0;
  const gate = new LocationGateController(h.adapter, () => {}, () => { stopped++; });
  const request = gate.request();
  await tick();
  h.grant();
  await request;
  assert.equal(h.counts().watches, 1);
  h.revokeWatch();
  assert.equal(gate.current.status, 'denied');
  assert.equal(stopped, 1);
  assert.deepEqual(h.counts().cleared, [42]);
  gate.dispose();
});

test('fallback browser location never watches in background or trusts an old grant on return', async () => {
  const h = browserHarness({ queryUnsupported: true });
  const request = h.adapter.request();
  await tick();
  h.grant();
  await request;
  h.adapter.setForeground(true, true);
  h.adapter.setForeground(false, false);
  assert.deepEqual(h.counts().cleared, [42]);
  h.adapter.setForeground(true, false);
  assert.equal((await h.adapter.check()).status, 'prompt');
  h.adapter.dispose();
});

test('backgrounding during a permission read cannot trigger a late native or browser prompt', async () => {
  const nativeRead = deferred();
  let nativeRequests = 0;
  const native = createNativeLocationAdapter({
    getForegroundPermissionsAsync: () => nativeRead.promise,
    requestForegroundPermissionsAsync: async () => { nativeRequests++; return { status: 'granted', granted: true }; },
    hasServicesEnabledAsync: async () => true,
  });
  const nativeRequest = native.request();
  native.setForeground(false, false);
  native.setForeground(true, false);
  nativeRead.resolve({ status: 'undetermined', granted: false, canAskAgain: true });
  assert.equal((await nativeRequest).status, 'checking');
  assert.equal(nativeRequests, 0);
  native.dispose();

  const browserRead = deferred();
  let browserRequests = 0;
  const browser = createWebLocationAdapter({
    isSecureContext: true,
    navigator: {
      geolocation: { getCurrentPosition: () => { browserRequests++; } },
      permissions: { query: () => browserRead.promise },
    },
  });
  const browserRequest = browser.request();
  browser.setForeground(false, false);
  browser.setForeground(true, false);
  browserRead.resolve({ state: 'prompt', addEventListener: () => {}, removeEventListener: () => {} });
  assert.equal((await browserRequest).status, 'checking');
  assert.equal(browserRequests, 0);
  browser.dispose();
});

test('a browser position delivered after background return is not retained as permission proof', async () => {
  const h = browserHarness({ queryUnsupported: true });
  const request = h.adapter.request();
  await tick();
  h.adapter.setForeground(false, false);
  h.adapter.setForeground(true, false);
  h.grant();
  assert.equal((await request).status, 'checking');
  assert.equal((await h.adapter.check()).status, 'prompt');
  h.adapter.dispose();
});

test('unmount ignores a pending browser grant and detaches permission listeners', async () => {
  const h = browserHarness();
  const pending = h.adapter.request();
  await tick();
  h.adapter.dispose();
  h.grant();
  assert.equal((await pending).status, 'checking');
  let changes = 0;
  const second = browserHarness({ permissionState: 'granted' });
  const gate = new LocationGateController(second.adapter, () => { changes++; }, () => {});
  await gate.refresh();
  gate.dispose();
  const before = changes;
  second.change('denied');
  assert.equal(changes, before);
});

test('all 12 supported languages have complete, nonempty required-location copy', () => {
  assert.deepEqual(Object.keys(locationGateCopies).sort(), ['en', 'ar', 'pt', 'es', 'fr', 'de', 'it', 'tr', 'ru', 'hi', 'zh', 'ja'].sort());
  for (const [language, copy] of Object.entries(locationGateCopies)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(locationGateCopies.en).sort(), language);
    for (const [key, text] of Object.entries(copy)) {
      assert.equal(typeof text, 'string', `${language}.${key}`);
      assert.ok(text.trim(), `${language}.${key}`);
      if (language !== 'en') assert.notEqual(text, locationGateCopies.en[key], `${language}.${key} must be translated`);
    }
  }
});