// Shared layout primitives to keep box model consistent across hosts.
export const layoutPrimitives = {
  fill: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    width: '100%',
    height: '100%',
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
  },
  fillRow: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    width: '100%',
  },
  fillColumn: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    width: '100%',
  },
  panelShell: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    height: '100%',
  },
} as const

