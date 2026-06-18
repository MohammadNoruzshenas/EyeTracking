declare module 'webgazer' {
    const webgazer: {
        begin: (onFail?: () => void) => Promise<any>;
        setTracker: (name: string) => void;
        addTrackerModule: (name: string, constructor: any) => void;
        setGazeListener: (callback: (data: any, elapsedTime: number) => void) => void;
        saveDataAcrossSessions: (val: boolean) => void;
        showPredictionPoints: (val: boolean) => { applyKalmanFilter: (val: boolean) => void };
        showVideoPreview: (val: boolean) => void;
        end: () => void;
        pause: () => void;
        resume: () => Promise<void>;
        params: any;
        tracker: any;
    };
    export default webgazer;
}
