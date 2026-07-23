import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import subscriptionsRouter from "./subscriptions";
import featuresRouter from "./features";
import graphsRouter from "./graphs";
import usageRouter from "./usage";
import billingRouter from "./billing";
import adminRouter from "./admin";
import notificationsRouter from "./notifications";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/features", featuresRouter);
router.use("/graphs", graphsRouter);
router.use("/usage", usageRouter);
router.use("/billing", billingRouter);
router.use("/admin", adminRouter);
router.use("/notifications", notificationsRouter);
router.use("/chat", chatRouter);

export default router;
