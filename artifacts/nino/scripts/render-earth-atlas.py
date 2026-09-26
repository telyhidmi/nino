# Regenerates assets/earth/globe_t0..8.jpg (orthographic sphere atlas).
# Usage (needs numpy + pillow): cd artifacts/nino/assets/earth && python ../../scripts/render-earth-atlas.py
# Source: earth_atmos_2048.jpg, three.js r160 examples/textures/planets (NASA Blue Marble, public domain).
SRC='earth_atmos_2048_source.jpg'; OUT='.'
GAMMA=0.62   # <1 brightens midtones/oceans
AMBIENT=0.72 # light on the night side
EXPOSURE=1.22
SAT=0.18     # saturation boost
import numpy as np
from PIL import Image
T=np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)/255
H,W,_=T.shape; S=256; F=128
ys,xs=np.mgrid[0:S,0:S]; x=(xs+.5)/S*2-1; y=1-(ys+.5)/S*2
r2=x*x+y*y; m=r2<=1; z=np.sqrt(np.clip(1-r2,0,1))
L=np.array([-.45,.5,.74]); L/=np.linalg.norm(L)
for ti,tilt in enumerate(range(-60,61,15)):
  t=np.radians(tilt); y0=y*np.cos(t)+z*np.sin(t); z0=-y*np.sin(t)+z*np.cos(t)
  lat=np.arcsin(np.clip(y0,-1,1)); sheet=Image.new('RGB',(9*F,8*F),(5,20,40))
  for k in range(72):
    lon=np.radians(k*5)+np.arctan2(x,z0)
    u=((lon/np.pi+1)/2)%1*W; v=(.5-lat/np.pi)*H
    u0=np.floor(u).astype(int); v0=np.clip(np.floor(v).astype(int),0,H-2); fu=(u-u0)[...,None]; fv=(v-v0)[...,None]
    u0%=W; u1=(u0+1)%W
    c=(T[v0,u0]*(1-fu)+T[v0,u1]*fu)*(1-fv)+(T[v0+1,u0]*(1-fu)+T[v0+1,u1]*fu)*fv
    d=np.clip(x*L[0]+y*L[1]+z*L[2],0,1); shade=AMBIENT+(1-AMBIENT)*d**.6
    c=np.clip(c,0,1)**GAMMA; c=c*(1+SAT)-c.mean(-1,keepdims=True)*SAT; c=c*shade[...,None]*EXPOSURE
    rim=(1-z)**3; c=c*(1-rim[...,None]*.3)+np.array([.45,.7,1.0])*rim[...,None]*.45
    c=np.clip(c,0,1); c[~m]=[.02,.08,.16]
    im=Image.fromarray((c*255).astype(np.uint8)).resize((F,F),Image.LANCZOS)
    sheet.paste(im,((k%9)*F,(k//9)*F))
  sheet.save(f'{OUT}/globe_t{ti}.jpg',quality=86)
