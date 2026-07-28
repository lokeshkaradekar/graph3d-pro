import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import subscriptionsRouter from "./subscriptions.js";
import featuresRouter from "./features.js";
import graphsRouter from "./graphs.js";
import usageRouter from "./usage.js";
import billingRouter from "./billing.js";
import adminRouter from "./admin.js";
import notificationsRouter from "./notifications.js";
import chatRouter from "./chat.js";

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
