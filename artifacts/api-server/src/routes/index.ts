import { Router, type IRouter } from "express";
import healthRouter from "./health";
import postsRouter from "./posts";
import liveRouter from "./live";
import messagingRouter from "./messaging";
import contentAssistRouter from "./contentAssist";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contentAssistRouter);
router.use(postsRouter);
router.use(liveRouter);
router.use(messagingRouter);

export default router;
