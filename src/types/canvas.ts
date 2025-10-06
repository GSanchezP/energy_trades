export interface Position {
  x: number;
  y: number;
}

export interface CanvasSquare {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  connectors: string[];
}

export interface Connector {
  id: string;
  from: string;
  to: string;
  points: number[];
}
