/**
 * 将 Vue Proxy / reactive 对象转换为 IndexedDB 可安全 structured-clone 的纯数据。
 *
 * 不能只依赖 JSON.stringify：社区资源与设置里可能出现 Date / Blob / Map / Set，
 * 而 Vue 的嵌套数组、对象也可能在任意层级变成 Proxy。这里递归重建容器，
 * 保留 IndexedDB 原生支持的数据类型，同时去掉函数、Symbol 与不可读取字段。
 */
export function toPlainStorageValue<T>(value: T): T {
  const seen = new WeakMap<object, unknown>()

  const sanitize = (input: unknown): unknown => {
    if (
      input === null ||
      typeof input === 'string' ||
      typeof input === 'number' ||
      typeof input === 'boolean' ||
      typeof input === 'bigint' ||
      typeof input === 'undefined'
    ) {
      return input
    }

    if (typeof input === 'function' || typeof input === 'symbol') return undefined
    if (typeof input !== 'object') return input

    const objectInput = input as object
    if (seen.has(objectInput)) return seen.get(objectInput)

    if (input instanceof Date) return new Date(input.getTime())
    if (input instanceof RegExp) return new RegExp(input.source, input.flags)

    if (typeof Blob !== 'undefined' && input instanceof Blob) {
      if (typeof File !== 'undefined' && input instanceof File) {
        return new File([input], input.name, {
          type: input.type,
          lastModified: input.lastModified
        })
      }
      return input.slice(0, input.size, input.type)
    }

    if (input instanceof ArrayBuffer) return input.slice(0)
    if (ArrayBuffer.isView(input)) {
      const view = input as ArrayBufferView
      const copied = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
      if (input instanceof DataView) return new DataView(copied)
      const TypedArrayCtor = input.constructor as {
        new (buffer: ArrayBufferLike): ArrayBufferView
      }
      return new TypedArrayCtor(copied)
    }

    if (input instanceof Map) {
      const output = new Map<unknown, unknown>()
      seen.set(objectInput, output)
      input.forEach((mapValue, key) => {
        output.set(sanitize(key), sanitize(mapValue))
      })
      return output
    }

    if (input instanceof Set) {
      const output = new Set<unknown>()
      seen.set(objectInput, output)
      input.forEach(item => output.add(sanitize(item)))
      return output
    }

    if (Array.isArray(input)) {
      const output: unknown[] = []
      seen.set(objectInput, output)
      for (const item of input) output.push(sanitize(item))
      return output
    }

    const output: Record<string, unknown> = {}
    seen.set(objectInput, output)
    for (const key of Object.keys(input)) {
      try {
        const next = sanitize((input as Record<string, unknown>)[key])
        if (next !== undefined) output[key] = next
      } catch {
        // 某些第三方对象可能包含会抛错的 getter；这类字段不能进入 IndexedDB。
      }
    }
    return output
  }

  return sanitize(value) as T
}
