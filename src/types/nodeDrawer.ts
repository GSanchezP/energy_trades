import { NodeLevel, NodeLevels, NodeType } from './nodesConfig'

export interface Position {
  x: number
  y: number
}

export const BASE_NODE_HEIGHT = 160
export const BASE_NODE_WIDTH = 120

export function nodeLevelValue(nodeLevel: NodeLevel) {
  return NodeLevels.indexOf(nodeLevel)
}

export function nextLevel(nodeLevel: NodeLevel) {
  return NodeLevels[nodeLevelValue(nodeLevel) + 1]
}

export function prevLevel(nodeLevel: NodeLevel) {
  return NodeLevels[nodeLevelValue(nodeLevel) - 1]
}

export class NodeDrawer {
  private _id: NodeType
  private _label: string
  private _level: { id: NodeLevel; value: number; position: number }
  private _position: Position = { x: 0, y: 0 }
  private _size: { height: number; width: number }
  private _color: string = '#ffffff'

  constructor(
    id: NodeType,
    nodeLevel: NodeLevel,
    nodeLevelPosition: number,
    color: string,
    size?: { height?: number; width?: number },
    label?: string
  ) {
    this._id = id
    this._label = label ?? id
    this._level = { id: nodeLevel, value: nodeLevelValue(nodeLevel), position: nodeLevelPosition }
    this._color = color
    this._size = { height: size?.height ?? BASE_NODE_HEIGHT, width: size?.width ?? BASE_NODE_WIDTH }
  }

  get id() {
    return this._id
  }

  get label(): string {
    return this._label
  }

  get level(): { id: NodeLevel; value: number; position: number } {
    return this._level
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
