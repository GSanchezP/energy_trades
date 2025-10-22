import { NodeLevel } from './nodesConfig'

export interface Position {
  x: number
  y: number
}

export const BASE_NODE_HEIGHT = 160
export const BASE_NODE_WIDTH = 120

export class NodeDrawer {
  private _nodeLevel: NodeLevel = 'dump'
  private _position: Position = { x: 0, y: 0 }
  private _size: { height: number; width: number }
  private _color: string = '#ffffff'

  constructor(nodeLevel: NodeLevel, color: string, size?: { height?: number; width?: number }) {
    this._nodeLevel = nodeLevel
    this._color = color
    this._size = { height: size?.height ?? BASE_NODE_HEIGHT, width: size?.width ?? BASE_NODE_WIDTH }
  }

  get id() {
    return 'Heat'
  }

  get nodeLevel(): NodeLevel {
    return this._nodeLevel
  }

  get color(): string {
    return this._color
  }

  set setPosition(pos: Position) {
    this._position = pos
  }

  get x() {
    return this._position.x
  }

  get y() {
    return this._position.y
  }

  set setSize(size: { height: number; width: number }) {
    this._size = size
  }

  get width() {
    return this._size.width
  }

  get height() {
    return this._size.height
  }
}
