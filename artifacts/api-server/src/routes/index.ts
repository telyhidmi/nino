import { Router, type IRouter } from "express";
import healthRouter from "./health";
import postsRouter from "./posts";
import liveRouter from "./live";

const router: IRouter = Router();

router.use(healthRouter);
router.use(postsRouter);
router.use(liveRouter);

export default router;
