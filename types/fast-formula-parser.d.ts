// fast-formula-parser ne fournit pas de types ; déclaration minimale.
declare module "fast-formula-parser" {
  export class FormulaParser {
    constructor(config?: {
      onCell?: (ref: { sheet?: string; row: number; col: number }) => any
      onRange?: (ref: { sheet?: string; from: { row: number; col: number }; to: { row: number; col: number } }) => any[][]
      functions?: Record<string, (...args: any[]) => any>
    })
    parse(formula: string, position?: { sheet?: string; row: number; col: number }): any
  }
  const _default: any
  export default _default
}
