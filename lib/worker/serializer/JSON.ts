import Serializer from "./Serializer";

class JSON extends Serializer {
    public encode(data: any): any {
        return data;
    }

    public decode(data: any): any {
        return data;
    }
}

export = JSON;
