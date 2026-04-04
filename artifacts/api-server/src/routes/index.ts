import { Router, type IRouter } from "express";
import healthRouter from "./health";
import suburbsRouter from "./suburbs";
import propertiesRouter from "./properties";
import spaceOptionsRouter from "./space-options";
import spacePoliciesRouter from "./space-policies";
import spacesRouter from "./spaces";

const router: IRouter = Router();

router.use(healthRouter);
router.use(suburbsRouter);
router.use(propertiesRouter);
router.use(spaceOptionsRouter);
router.use(spacePoliciesRouter);
router.use(spacesRouter);

export default router;
