export declare class AppService {
    private readonly version;
    constructor();
    getHealth(): {
        status: string;
        version: string;
    };
}
