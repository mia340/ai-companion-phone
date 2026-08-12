/**
 * 将 Vue Proxy / reactive 对象转换为 IndexedDB 可安全 structured-clone 的纯数据。
 * 角色卡、Persona 等社区资源会包含嵌套数组和对象；如果这些数据经过 ref/reactive，
 * Dexie/IndexedDB 直接保存时可能触发 DataCloneError。
 */
export function toPlainStorageValue<T>(value: T): T {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) return value
  return JSON.parse(serialized) as T
}
