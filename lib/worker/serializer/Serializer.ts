export default abstract class Serializer {
    public abstract encode(data: any): any;
    public abstract decode(data: any): any;
}
