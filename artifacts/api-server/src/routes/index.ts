import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/openai", openaiRouter);
router.use(stripeRouter);

export default router;
