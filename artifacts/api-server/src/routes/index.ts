import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import stripeRouter from "./stripe";
import authRouter from "./auth";
import circlesRouter from "./circles";
import communityRouter from "./community";
import foundersRouter from "./founders";
import foodVisionRouter from "./food-vision";
import outfitVisionRouter from "./outfit-vision";
import roseWallRouter from "./rose-wall";
import supportRouter from "./support";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/openai", openaiRouter);
router.use(stripeRouter);
router.use(authRouter);
router.use(circlesRouter);
router.use(communityRouter);
router.use(foundersRouter);
router.use(foodVisionRouter);
router.use(outfitVisionRouter);
router.use(roseWallRouter);
router.use(supportRouter);

export default router;
