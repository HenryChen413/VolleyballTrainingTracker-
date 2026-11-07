/** 記錄單統計欄位代碼（與後端 counts 的 key 一致） */
export type StatKey =
  | 'serveO' | 'serveX'
  | 'atkO' | 'atkNo' | 'atkOut'
  | 'tipO' | 'tipX'
  | 'recvO' | 'recvX'
  | 'digO' | 'digMiss' | 'digShank'
  | 'freeO' | 'freeX'
  | 'setO' | 'setX'
  | 'blockO' | 'blockX'
  | 'coverX'
  | 'fault';

export interface StatGroup {
  title: string;
  cols: { key: StatKey; label: string }[];
}

/** 欄位分組（依記錄單由左至右順序） */
export const STAT_GROUPS: StatGroup[] = [
  { title: '發球', cols: [{ key: 'serveO', label: 'O' }, { key: 'serveX', label: 'X' }] },
  { title: '攻擊/舉球', cols: [{ key: 'atkO', label: 'O' }, { key: 'atkNo', label: 'no' }, { key: 'atkOut', label: 'out' }] },
  { title: '吊球', cols: [{ key: 'tipO', label: 'O' }, { key: 'tipX', label: 'X' }] },
  { title: '接發', cols: [{ key: 'recvO', label: 'O' }, { key: 'recvX', label: 'X' }] },
  { title: '接扣', cols: [{ key: 'digO', label: 'O' }, { key: 'digMiss', label: '未' }, { key: 'digShank', label: '噴' }] },
  { title: '接小', cols: [{ key: 'freeO', label: 'O' }, { key: 'freeX', label: 'X' }] },
  { title: '修正', cols: [{ key: 'setO', label: 'O' }, { key: 'setX', label: 'X' }] },
  { title: '攔網', cols: [{ key: 'blockO', label: 'O' }, { key: 'blockX', label: 'X' }] },
  { title: 'Cover/鬆把', cols: [{ key: 'coverX', label: 'X' }] },
  { title: '犯規', cols: [{ key: 'fault', label: '' }] },
];

/** 自動算入「我方失誤」的欄位：各項 X、攻擊 no/out、接扣 未/噴、犯規 */
export const OUR_ERROR_KEYS: readonly StatKey[] = [
  'serveX', 'atkNo', 'atkOut', 'tipX', 'recvX', 'digMiss', 'digShank', 'freeX', 'setX', 'blockX', 'coverX', 'fault',
];

/** 攤平後的欄位代碼順序 */
export const STAT_KEYS: StatKey[] = STAT_GROUPS.flatMap((g) => g.cols.map((c) => c.key));
