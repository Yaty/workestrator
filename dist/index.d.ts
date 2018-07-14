import Farm from "./Farm";
import { FarmOptions } from "./types";
export declare function create(options: FarmOptions): Farm;
export declare function kill(): Promise<void>;
export default create;
