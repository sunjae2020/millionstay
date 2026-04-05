import { Router, type IRouter } from "express";
import healthRouter from "./health";
import suburbsRouter from "./suburbs";
import propertiesRouter from "./properties";
import spaceOptionsRouter from "./space-options";
import spacePoliciesRouter from "./space-policies";
import spacesRouter from "./spaces";
import commissionsRouter from "./commissions";
import paymentInfoRouter from "./payment-info";
import contactsRouter from "./contacts";
import accountsRouter from "./accounts";
import lookupRouter from "./lookup";
import tasksRouter from "./tasks";
import leadsRouter from "./leads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(suburbsRouter);
router.use(propertiesRouter);
router.use(spaceOptionsRouter);
router.use(spacePoliciesRouter);
router.use(spacesRouter);
router.use(commissionsRouter);
router.use(paymentInfoRouter);
router.use(contactsRouter);
router.use(accountsRouter);
router.use(lookupRouter);
router.use(tasksRouter);
router.use(leadsRouter);

export default router;
