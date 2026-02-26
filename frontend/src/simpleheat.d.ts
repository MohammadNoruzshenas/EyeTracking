declare module 'simpleheat' {
    export default function simpleheat(canvas: HTMLCanvasElement | string): {
        data(data: Array<[number, number, number]>): any;
        add(point: [number, number, number]): any;
        clear(): any;
        radius(r: number, blur?: number): any;
        max(max: number): any;
        draw(minOpacity?: number): any;
        gradient(grad: { [key: number]: string }): any;
    };
}
