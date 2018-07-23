import * as cbor from "cbor";
import Serializer from "./Serializer";

class CBOR extends Serializer {
    public encode(data: any): any {
        return cbor.encode(data).toString("hex");
    }

    public async decode(data: any): Promise<any> {
        return await (cbor as any).decodeFirst(data);
    }
}

export = CBOR;
