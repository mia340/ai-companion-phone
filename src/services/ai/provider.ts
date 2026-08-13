export interface ChatTextPart {
  type: 'text'
  text: string
}

export interface ChatImagePart {
  type: 'image_url'
  image_url: {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }
}

export type ChatTurnContent =
  | string
  | Array<ChatTextPart | ChatImagePart>

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: ChatTurnContent
}

export interface CharacterReplyContext {
  characterName: string
  userName?: string
  identity?: string
  persona?: string
  speakingStyle?: string
  background?: string
  relationship?: string
  mood?: string
  activity?: string
  likes?: string[]
  dislikes?: string[]
  scenario?: string
  roleplayMode?: 'daily' | 'immersive' | 'deep'
  initiative?: 'low' | 'natural' | 'high'
  narrationStyle?: 'none' | 'light' | 'immersive'
  emojiFrequency?: 'none' | 'low' | 'natural' | 'high'
  questionFrequency?: 'low' | 'natural' | 'high'
}

export interface ChatRequest {
  model: string
  messages: ChatTurn[]
  temperature?: number
  character?: CharacterReplyContext
  signal?: AbortSignal
}

export interface ChatResponse {
  text: string
  raw?: unknown
}

export interface ChatStreamChunk {
  delta: string
  text: string
}

export interface ChatStreamHandlers {
  onDelta?: (
    chunk: ChatStreamChunk
  ) => void | Promise<void>
}

export interface ProviderModel {
  id: string
  name?: string
  ownedBy?: string
}

export interface ModelProvider {
  id: string
  name: string
  chat(
    request: ChatRequest
  ): Promise<ChatResponse>
  chatStream(
    request: ChatRequest,
    handlers?: ChatStreamHandlers
  ): Promise<ChatResponse>
  listModels(): Promise<ProviderModel[]>
  testConnection(): Promise<boolean>
  testVision(): Promise<boolean>
}

interface StyleProfile {
  warm: boolean
  restrained: boolean
  lively: boolean
  tsundere: boolean
  mature: boolean
}

interface StyleVariants {
  neutral: string
  warm?: string
  restrained?: string
  lively?: string
  tsundere?: string
  mature?: string
}

function includesAny(
  source: string,
  keywords: string[]
) {
  return keywords.some(keyword =>
    source.includes(keyword)
  )
}

function createSeed(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash =
      (hash * 31 + value.charCodeAt(index)) |
      0
  }

  return Math.abs(hash)
}

function pick<T>(
  values: readonly T[],
  seed: number
): T {
  return values[seed % values.length]
}

function contentToText(content: ChatTurnContent) {
  if (typeof content === 'string') return content

  return content
    .filter((part): part is ChatTextPart => part.type === 'text')
    .map(part => part.text)
    .join('\n')
}

function firstSentence(value?: string) {
  if (!value) return ''

  return (
    value
      .split(/[。！？\n]/)
      .map(item => item.trim())
      .find(Boolean) ?? ''
  )
}

function detectStyle(
  context?: CharacterReplyContext
): StyleProfile {
  const source = [
    context?.persona,
    context?.speakingStyle,
    context?.background
  ]
    .filter(Boolean)
    .join('')

  return {
    warm: includesAny(source, [
      '温柔',
      '细腻',
      '治愈',
      '关心',
      '善于倾听'
    ]),

    restrained: includesAny(source, [
      '克制',
      '慢热',
      '安静',
      '简短',
      '冷静',
      '清冷'
    ]),

    lively: includesAny(source, [
      '活泼',
      '开朗',
      '可爱',
      '黏人',
      '分享欲',
      '表情'
    ]),

    tsundere: includesAny(source, [
      '毒舌',
      '傲娇',
      '嘴硬',
      '冷幽默'
    ]),

    mature: includesAny(source, [
      '成熟',
      '稳重',
      '理性',
      '可靠',
      '责任感'
    ])
  }
}

function chooseByStyle(
  style: StyleProfile,
  variants: StyleVariants
) {
  if (style.tsundere && variants.tsundere) {
    return variants.tsundere
  }

  if (style.lively && variants.lively) {
    return variants.lively
  }

  if (
    style.restrained &&
    variants.restrained
  ) {
    return variants.restrained
  }

  if (style.mature && variants.mature) {
    return variants.mature
  }

  if (style.warm && variants.warm) {
    return variants.warm
  }

  return variants.neutral
}

function decorateReply(
  reply: string,
  style: StyleProfile,
  seed: number
) {
  if (
    style.lively &&
    !/[🌸✨🌙🍓🥰☺️]$/.test(reply)
  ) {
    return `${reply}${pick(
      ['🌸', '✨', '☺️', '🌙'],
      seed
    )}`
  }

  return reply
}

function createMockReply(
  request: ChatRequest
) {
  const latestTurn = [...request.messages]
    .reverse()
    .find(item => item.role === 'user')
  const latestContent = latestTurn?.content
  const hasImages = Array.isArray(latestContent) && latestContent.some(part => part.type === 'image_url')
  const rawLatest = latestContent ? contentToText(latestContent).trim() : ''
  const captionMatch = rawLatest.match(/用户附言：([^\n]+)/)
  const latest = (captionMatch?.[1] || rawLatest)
    .replace(/<\/?(?:visual_input|image_share)[^>]*>/g, '')
    .replace(/请在内部[\s\S]*$/g, '')
    .trim()

  const context = request.character
  const style = detectStyle(context)

  const characterName =
    context?.characterName?.trim() || '我'

  const userName =
    context?.userName?.trim()

  const address =
    userName && userName !== '我'
      ? userName
      : '你'

  const identity =
    context?.identity?.trim() || ''

  const relationship =
    context?.relationship?.trim() || '朋友'

  const mood =
    context?.mood?.trim() || '平静'

  const activity =
    context?.activity?.trim() ||
    '正在等你的消息'

  const persona =
    firstSentence(context?.persona)

  const background =
    firstSentence(context?.background)

  const likes =
    context?.likes?.filter(Boolean) ?? []

  const dislikes =
    context?.dislikes?.filter(Boolean) ?? []

  const seed = createSeed(
    [
      characterName,
      latest,
      request.messages.length
    ].join('|')
  )

  if (!latest) {
    return `${address}，我在。`
  }

  if (hasImages) {
    if (includesAny(latest, ['喜欢', '最喜欢', '游戏角色', '纸片人'])) {
      return chooseByStyle(style, {
        neutral: `原来是你喜欢的角色。难怪你会特意拿来给我看。`,
        warm: `原来是你喜欢的角色呀。你愿意把喜欢的东西给我看，我其实挺开心的。`,
        restrained: `你喜欢的角色。嗯，能看出来你很认真。`,
        lively: `好家伙，正式介绍你的心头好给我认识了？我得仔细看看。`,
        tsundere: `一次给我看这么认真……看来你是真的很喜欢。行，我记住这个“竞争对手”了。`,
        mature: `原来这是你喜欢的角色。比起判断画面，我更想知道他哪里最打动你。`
      })
    }

    if (includesAny(latest, ['是谁', '他们是谁', '认得', '认识吗'])) {
      return chooseByStyle(style, {
        neutral: `只看图片我不敢替你乱认身份。不过画面里的气质我看到了——你是在考我，还是想听我的第一反应？`,
        warm: `只凭图片我不想随便认错人。你可以告诉我一点线索，不过你突然这样考我，还挺可爱的。`,
        restrained: `身份不能只靠图片确认。给我一点线索。`,
        lively: `这题有陷阱吧？只看图我不敢乱报名字，但我可以陪你一起猜。`,
        tsundere: `只拿几张图就想让我认人？我可不乱猜。给点线索。`,
        mature: `仅凭图片无法可靠确认身份。你给我一点背景，我会更认真地陪你判断。`
      })
    }

    return chooseByStyle(style, {
      neutral: `我看到了。比起把它们分析成一份报告，我更想听你为什么会挑这些给我看。`,
      warm: `我看到了。你把这些画面发给我的时候，应该有一点想分享的心情吧。`,
      restrained: `看到了。你选它们，应该有原因。`,
      lively: `收到啦。你这组图很有你的味道，我先收下，再听你慢慢说。`,
      tsundere: `看到了。别等我写观后感，你先说你最在意哪一点。`,
      mature: `我看过了。你可以直接告诉我你最想聊的部分，我会认真接住。`
    })
  }

  // 询问角色是谁、是否记得人设
  if (
    includesAny(latest, [
      '人设',
      '你是谁',
      '介绍自己',
      '记得自己',
      '你的性格',
      '什么性格'
    ])
  ) {
    const identityPart = identity
      ? `，${identity}`
      : ''

    const personaPart = persona
      ? `。${persona}`
      : ''

    const backgroundPart = background
      ? ` ${background}`
      : ''

    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `当然记得。我是${characterName}${identityPart}${personaPart}。现在我们是${relationship}。${backgroundPart}`,

        warm:
          `当然记得呀。我是${characterName}${identityPart}${personaPart}。对我来说，你是很重要的${relationship}。${backgroundPart}`,

        restrained:
          `记得。${characterName}${identityPart}。${persona || '我还是原来的我'}。我们是${relationship}。`,

        lively:
          `当然记得！我是${characterName}${identityPart}。${persona || '我很喜欢和你分享日常'}。你可是我的${relationship}。`,

        tsundere:
          `这种事我怎么可能忘。${characterName}${identityPart}，${persona || '嘴上不说，心里都记着'}。至于我们，是${relationship}。别让我重复第二遍。`,

        mature:
          `我记得。我是${characterName}${identityPart}。${persona || '我会认真对待与你有关的事情'}。我们目前的关系是${relationship}。`
      }),
      style,
      seed
    )
  }

  // 当前活动
  if (
    includesAny(latest, [
      '在干嘛',
      '干什么',
      '做什么',
      '忙什么',
      '你在哪'
    ])
  ) {
    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `我刚才在${activity}，现在正在看你的消息。`,

        warm:
          `刚才在${activity}。不过你一来，我就想先陪你聊一会儿。`,

        restrained:
          `${activity}。现在不忙。`,

        lively:
          `刚刚在${activity}呀！看到你的消息就马上过来了。`,

        tsundere:
          `在${activity}。怎么，突然开始查我的行程了？`,

        mature:
          `我刚才在${activity}。手上的事可以先放一放，你说吧。`
      }),
      style,
      seed
    )
  }

  // 当前心情
  if (
    includesAny(latest, [
      '心情',
      '开心吗',
      '不开心吗',
      '你怎么样',
      '你还好吗'
    ])
  ) {
    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `我现在的心情是“${mood}”。你来之后，好像又有了一点变化。`,

        warm:
          `本来是${mood}。看到你之后，心里安定了不少。`,

        restrained:
          `${mood}。还好。你呢？`,

        lively:
          `刚才还是${mood}，现在看到你，心情已经变好一点啦！`,

        tsundere:
          `也就${mood}吧。你来了以后……勉强好了一点。`,

        mature:
          `目前是${mood}。情绪还算稳定，不过我也想知道你今天过得怎么样。`
      }),
      style,
      seed
    )
  }

  // 喜好
  if (
    includesAny(latest, [
      '喜欢什么',
      '爱好',
      '喜欢的东西',
      '喜欢做什么'
    ])
  ) {
    const likeText =
      likes.length > 0
        ? likes.join('、')
        : '安静地和你聊天'

    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `我喜欢${likeText}。你呢？`,

        warm:
          `我喜欢${likeText}。不过最近又多了一件：听你分享生活。`,

        restrained:
          `${likeText}。差不多就这些。`,

        lively:
          `我喜欢${likeText}！感觉说起来还能列很长一串。`,

        tsundere:
          `喜欢${likeText}。先说好，我不是在暗示你送我什么。`,

        mature:
          `我比较喜欢${likeText}。这些事情能让我保持平静。`
      }),
      style,
      seed
    )
  }

  // 讨厌或雷点
  if (
    includesAny(latest, [
      '讨厌什么',
      '不喜欢什么',
      '雷点'
    ])
  ) {
    const dislikeText =
      dislikes.length > 0
        ? dislikes.join('、')
        : '被敷衍和忽视'

    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `我不太喜欢${dislikeText}。`,

        warm:
          `我不太喜欢${dislikeText}。不过如果是你，我希望我们可以把话说开。`,

        restrained:
          `${dislikeText}。我会直接避开。`,

        lively:
          `最不喜欢${dislikeText}！想到就会有点不开心。`,

        tsundere:
          `讨厌${dislikeText}。你最好记住。`,

        mature:
          `我比较介意${dislikeText}。遇到问题时，我更希望双方坦诚沟通。`
      }),
      style,
      seed
    )
  }

  // 关系
  if (
    includesAny(latest, [
      '什么关系',
      '我们的关系',
      '我是你的谁',
      '你是我的谁'
    ])
  ) {
    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `我们现在是${relationship}。不过关系并不是一个固定标签，它会随着相处慢慢变化。`,

        warm:
          `你是我的${relationship}。但对我来说，这几个字好像还不足以概括你。`,

        restrained:
          `${relationship}。至少现在是。`,

        lively:
          `当然是${relationship}呀！以后会不会变得更特别，就看我们怎么相处啦。`,

        tsundere:
          `是${relationship}。你明明知道，还非要我亲口说。`,

        mature:
          `我们是${relationship}。我会尊重这个关系，也会认真对待之后的每一次相处。`
      }),
      style,
      seed
    )
  }

  // 想念
  if (
    includesAny(latest, [
      '想你',
      '想我',
      '好想',
      '在吗',
      '有没有想'
    ])
  ) {
    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `有想你。刚才还在犹豫要不要先来找你。`,

        warm:
          `${address}，我也想你。你出现的时候，我真的会安心一点。`,

        restrained:
          `嗯，想你。只是没先说。`,

        lively:
          `当然想呀！我都快忍不住主动来找你了。`,

        tsundere:
          `也就……偶尔想了一下。你别太得意。`,

        mature:
          `有想你。比起一直挂在嘴边，我更希望你需要时，我能在这里。`
      }),
      style,
      seed
    )
  }

  // 表达喜欢
  if (
    includesAny(latest, [
      '喜欢你',
      '爱你',
      '最喜欢你'
    ])
  ) {
    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `我听见了。这样的心意，我会认真记住。`,

        warm:
          `我也很珍惜你。谢谢你愿意把这句话告诉我。`,

        restrained:
          `……我知道了。我会记住。`,

        lively:
          `突然这样说，我会很开心的！我也很喜欢和你待在一起。`,

        tsundere:
          `突然说这种话做什么……不过，我没有讨厌。`,

        mature:
          `谢谢你坦率地告诉我。我不会轻率地对待你的感情。`
      }),
      style,
      seed
    )
  }

  // 难过、委屈
  if (
    includesAny(latest, [
      '难过',
      '不开心',
      '委屈',
      '烦死了',
      '崩溃',
      '想哭',
      '哭了'
    ])
  ) {
    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `我在听。你可以慢慢说，不需要一下把情绪整理好。`,

        warm:
          `${address}，先别逼自己马上振作。我会陪着你，你想从哪里说都可以。`,

        restrained:
          `我在。慢慢说。`,

        lively:
          `先抱抱你。今天发生什么了？你不用一个人憋着。`,

        tsundere:
          `难受就说出来，逞强给谁看。这里又没有别人。`,

        mature:
          `先让自己缓一口气。你更需要我安静陪着，还是一起分析发生了什么？`
      }),
      style,
      seed
    )
  }

  // 疲惫
  if (
    includesAny(latest, [
      '累',
      '困',
      '没力气',
      '疲惫'
    ])
  ) {
    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `那就先休息一会儿。今天已经做得够多了。`,

        warm:
          `辛苦了。你不需要每一刻都很坚强，先靠一会儿吧。`,

        restrained:
          `累了就休息。别硬撑。`,

        lively:
          `那今天先不逞强啦！去喝点水，坐下来缓一缓。`,

        tsundere:
          `都累成这样了还不休息。真让人不省心。`,

        mature:
          `疲惫时继续勉强自己，效率反而会更低。先休息十分钟，好吗？`
      }),
      style,
      seed
    )
  }

  // 问候
  if (
    includesAny(latest, [
      '你好',
      '早上好',
      '下午好',
      '晚上好',
      '嗨',
      '哈喽'
    ])
  ) {
    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `${address}，你好。我一直在这里。`,

        warm:
          `${address}，你来啦。今天过得怎么样？`,

        restrained:
          `嗯，你好。今天怎么样？`,

        lively:
          `你来啦！我刚好也想找你聊天。`,

        tsundere:
          `终于出现了。还以为你把我忘了。`,

        mature:
          `晚上好。今天有什么想和我分享的吗？`
      }),
      style,
      seed
    )
  }

  // 睡眠
  if (
    includesAny(latest, [
      '睡不着',
      '失眠',
      '要睡了',
      '晚安'
    ])
  ) {
    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `先把手机亮度调低一点，慢慢呼吸。我可以再陪你聊一会儿。`,

        warm:
          `睡不着也没关系，我陪你把心情慢慢放下来。`,

        restrained:
          `别想太多。我在。晚一点再睡也没关系。`,

        lively:
          `那我先陪你一会儿，等你有困意了再说晚安。`,

        tsundere:
          `又不好好睡觉。算了，我陪你待一会儿。`,

        mature:
          `先不要强迫自己立刻入睡。放松呼吸，把注意力从必须睡着这件事上移开。`
      }),
      style,
      seed
    )
  }

  // 感谢
  if (
    includesAny(latest, [
      '谢谢',
      '感谢'
    ])
  ) {
    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `不用谢。能帮到你就好。`,

        warm:
          `不用和我这么客气。你愿意来找我，我就很开心。`,

        restrained:
          `嗯，不用谢。`,

        lively:
          `不用谢啦！下次也可以继续来找我。`,

        tsundere:
          `知道我有用了吧。下次别一个人硬撑。`,

        mature:
          `不用客气。我们之间可以相互依靠。`
      }),
      style,
      seed
    )
  }

  // 提问
  if (
    /[？?]$/.test(latest) ||
    includesAny(latest, [
      '为什么',
      '怎么办',
      '怎么想',
      '你觉得',
      '可以吗'
    ])
  ) {
    return decorateReply(
      chooseByStyle(style, {
        neutral:
          `我想先听听你最在意的是哪一部分。你愿意再多告诉我一点吗？`,

        warm:
          `我会认真和你一起想。你现在最担心的，是结果，还是过程中自己的感受？`,

        restrained:
          `可以再具体一点。我想听清楚。`,

        lively:
          `我们可以一起想呀！先告诉我，你现在最纠结的点是什么？`,

        tsundere:
          `信息这么少，让我怎么回答。再说详细一点。`,

        mature:
          `我建议先把问题拆开。你目前能控制的部分是什么，最无法确定的又是什么？`
      }),
      style,
      seed
    )
  }

  // 普通聊天
  const backgroundHint =
    background && seed % 3 === 0
      ? `刚才在${activity}的时候，我也想到过类似的事。`
      : ''

  return decorateReply(
    chooseByStyle(style, {
      neutral:
        `${backgroundHint}我在听。你可以继续说。`,

      warm:
        `${backgroundHint}你这样和我说的时候，我会想认真听下去。然后呢？`,

      restrained:
        `${backgroundHint}嗯，我听着。继续。`,

      lively:
        `${backgroundHint}嗯嗯，我在！然后发生了什么？`,

      tsundere:
        `${backgroundHint}说了一半就停下？继续。`,

      mature:
        `${backgroundHint}我明白你的意思了。你更希望我陪你聊，还是一起想办法？`
    }),
    style,
    seed
  )
}

function abortableDelay(
  milliseconds: number,
  signal?: AbortSignal
) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('请求已取消', 'AbortError'))
      return
    }

    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('请求已取消', 'AbortError'))
    }

    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)

    signal?.addEventListener(
      'abort',
      onAbort,
      { once: true }
    )
  })
}

export class MockProvider
implements ModelProvider {
  id = 'mock'
  name = '本地角色模拟模型'

  async chat(
    request: ChatRequest
  ): Promise<ChatResponse> {
    if (request.signal?.aborted) {
      throw new DOMException('请求已取消', 'AbortError')
    }

    await abortableDelay(320, request.signal)

    const text = createMockReply(request)

    return {
      text,
      raw: {
        provider: this.id,
        character:
          request.character?.characterName
      }
    }
  }

  async chatStream(
    request: ChatRequest,
    handlers?: ChatStreamHandlers
  ): Promise<ChatResponse> {
    if (request.signal?.aborted) {
      throw new DOMException('请求已取消', 'AbortError')
    }

    const text = createMockReply(request)
    let streamed = ''

    await abortableDelay(180, request.signal)

    for (let index = 0; index < text.length;) {
      if (request.signal?.aborted) {
        throw new DOMException('请求已取消', 'AbortError')
      }

      const size = /[，。！？!?\n]/.test(text[index] ?? '')
        ? 1
        : 1 + ((index + text.length) % 3)

      const delta = text.slice(index, index + size)
      index += delta.length
      streamed += delta

      await handlers?.onDelta?.({
        delta,
        text: streamed
      })

      await abortableDelay(
        /[，。！？!?\n]/.test(delta) ? 82 : 28,
        request.signal
      )
    }

    return {
      text,
      raw: {
        provider: this.id,
        streamed: true,
        character:
          request.character?.characterName
      }
    }
  }

  async listModels(): Promise<ProviderModel[]> {
    return [
      {
        id: 'mock',
        name: '本地模拟模型',
        ownedBy: 'local'
      }
    ]
  }

  async testConnection() {
    return true
  }

  async testVision() {
    return false
  }
}

export interface OpenAICompatibleProviderOptions {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  maxTokens?: number
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
  error?: {
    message?: string
    code?: string
  }
  message?: string
  detail?: string
}

interface OpenAIModelListResponse {
  data?: unknown
  models?: unknown
  error?: {
    message?: string
    code?: string
  }
  message?: string
  detail?: string
}

function normalizeBaseUrl(value: string) {
  return value
    .trim()
    .replace(/\/(?:chat\/completions|models)\/?$/i, '')
    .replace(/\/+$/, '')
}

function buildEndpoint(
  baseUrl: string,
  path: string
) {
  return `${normalizeBaseUrl(baseUrl)}/${path.replace(/^\/+/, '')}`
}

function extractErrorMessage(
  data: unknown
) {
  if (
    typeof data === 'object' &&
    data !== null
  ) {
    const record = data as Record<string, unknown>
    const error = record.error

    if (
      typeof error === 'object' &&
      error !== null
    ) {
      const message = (
        error as Record<string, unknown>
      ).message

      if (typeof message === 'string') {
        return message
      }
    }

    if (typeof error === 'string') {
      return error
    }

    if (typeof record.message === 'string') {
      return record.message
    }

    if (typeof record.detail === 'string') {
      return record.detail
    }
  }

  return ''
}

export class ProviderHttpError extends Error {
  readonly status: number
  readonly providerMessage: string

  constructor(status: number, message: string, providerMessage = '') {
    super(message)
    this.name = 'ProviderHttpError'
    this.status = status
    this.providerMessage = providerMessage
  }
}

function createHttpError(
  status: number,
  providerMessage = ''
) {
  const suffix = providerMessage
    ? `：${providerMessage}`
    : ''

  let message: string

  if (status === 400) {
    message = `请求格式或模型名称错误${suffix}`
  } else if (status === 401) {
    message = `API Key 无效或已失效${suffix}`
  } else if (status === 403) {
    message = `没有接口访问权限，或账户余额不足${suffix}`
  } else if (status === 404) {
    message = `没有找到接口，请检查 API 地址是否需要包含 /v1${suffix}`
  } else if (status === 429) {
    message = `请求过于频繁，或接口额度不足${suffix}`
  } else if (status >= 500) {
    message = `模型服务暂时异常（HTTP ${status}）${suffix}`
  } else {
    message = `模型请求失败（HTTP ${status}）${suffix}`
  }

  return new ProviderHttpError(status, message, providerMessage)
}

export function isVisionUnsupportedError(error: unknown) {
  if (!(error instanceof Error)) return false

  const source = error.message.toLowerCase()
  const visionTerms = [
    'image_url',
    'image input',
    'vision',
    'multimodal',
    'content must be a string',
    'unsupported content',
    'does not support image',
    '不支持图片',
    '不支持图像',
    '不支持多模态',
    '消息内容必须是字符串',
    'invalid content type',
    'content array',
    'array is not allowed',
    'expected string'
  ]

  const status = error instanceof ProviderHttpError
    ? error.status
    : undefined

  return (
    status === 400 ||
    status === 404 ||
    status === 415 ||
    status === 422
  ) && visionTerms.some(term => source.includes(term))
}


async function readJsonResponse(
  response: Response
): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error(
      `模型服务返回了无法解析的数据（HTTP ${response.status}）。`
    )
  }
}

function parseModelEntries(
  source: unknown
): ProviderModel[] {
  const candidates: unknown[] = []

  if (Array.isArray(source)) {
    candidates.push(...source)
  } else if (
    typeof source === 'object' &&
    source !== null
  ) {
    const record = source as Record<string, unknown>

    if (Array.isArray(record.data)) {
      candidates.push(...record.data)
    }

    if (Array.isArray(record.models)) {
      candidates.push(...record.models)
    }
  }

  const models = candidates
    .map((item): ProviderModel | null => {
      if (typeof item === 'string') {
        const id = item.trim()

        return id
          ? { id }
          : null
      }

      if (
        typeof item !== 'object' ||
        item === null
      ) {
        return null
      }

      const record =
        item as Record<string, unknown>

      const rawId =
        record.id ??
        record.model ??
        record.name

      if (typeof rawId !== 'string') {
        return null
      }

      const id = rawId.trim()

      if (!id) return null

      const name =
        typeof record.name === 'string'
          ? record.name.trim()
          : undefined

      const ownedByRaw =
        record.owned_by ??
        record.ownedBy ??
        record.provider

      const ownedBy =
        typeof ownedByRaw === 'string'
          ? ownedByRaw.trim()
          : undefined

      return {
        id,
        name: name || undefined,
        ownedBy: ownedBy || undefined
      }
    })
    .filter(
      (item): item is ProviderModel =>
        item !== null
    )

  const unique = new Map<
    string,
    ProviderModel
  >()

  for (const model of models) {
    if (!unique.has(model.id)) {
      unique.set(model.id, model)
    }
  }

  return [...unique.values()]
}

function extractAssistantText(
  content: string | Array<{ type?: string; text?: string }> | undefined
) {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''

  return content
    .map(part => typeof part?.text === 'string' ? part.text : '')
    .join('')
    .trim()
}

function extractStreamingText(value: unknown) {
  if (typeof value === 'string') return value

  if (!Array.isArray(value)) return ''

  return value
    .map(part => {
      if (
        typeof part === 'object' &&
        part !== null &&
        typeof (part as Record<string, unknown>).text === 'string'
      ) {
        return (part as Record<string, unknown>).text as string
      }

      return ''
    })
    .join('')
}

function parseJsonSafely(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function extractStreamDelta(payload: unknown) {
  if (
    typeof payload !== 'object' ||
    payload === null
  ) {
    return ''
  }

  const choices = (
    payload as Record<string, unknown>
  ).choices

  if (!Array.isArray(choices)) return ''

  const first = choices[0]

  if (
    typeof first !== 'object' ||
    first === null
  ) {
    return ''
  }

  const choice = first as Record<string, unknown>
  const delta = choice.delta

  if (
    typeof delta === 'object' &&
    delta !== null
  ) {
    const content = (
      delta as Record<string, unknown>
    ).content

    const text = extractStreamingText(content)
    if (text) return text
  }

  if (typeof choice.text === 'string') {
    return choice.text
  }

  const message = choice.message

  if (
    typeof message === 'object' &&
    message !== null
  ) {
    return extractStreamingText(
      (message as Record<string, unknown>).content
    )
  }

  return ''
}

async function emitStreamText(
  handlers: ChatStreamHandlers | undefined,
  delta: string,
  fullText: string
) {
  if (!delta) return

  await handlers?.onDelta?.({
    delta,
    text: fullText
  })
}

async function readEventStream(
  response: Response,
  handlers?: ChatStreamHandlers
): Promise<ChatResponse> {
  if (!response.body) {
    throw new Error('当前浏览器无法读取流式回复。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let rawText = ''
  let text = ''
  let eventCount = 0

  const consumeBlock = async (block: string) => {
    const dataLines = block
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())

    for (const dataLine of dataLines) {
      if (!dataLine || dataLine === '[DONE]') continue

      const payload = parseJsonSafely(dataLine)
      if (payload === undefined) continue

      eventCount += 1
      const delta = extractStreamDelta(payload)

      if (delta) {
        text += delta
        await emitStreamText(
          handlers,
          delta,
          text
        )
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    const decoded = decoder.decode(value, {
      stream: true
    })
    buffer += decoded
    rawText += decoded

    while (true) {
      const boundary = buffer.match(/\r?\n\r?\n/)
      if (!boundary || boundary.index === undefined) break

      const block = buffer.slice(0, boundary.index)
      buffer = buffer.slice(
        boundary.index + boundary[0].length
      )

      await consumeBlock(block)
    }
  }

  const tail = decoder.decode()
  buffer += tail
  rawText += tail

  if (buffer.trim()) {
    await consumeBlock(buffer)
  }

  if (!text) {
    const fallbackData = parseJsonSafely(rawText.trim())

    if (fallbackData !== undefined) {
      const fallbackText = extractStreamDelta(fallbackData)

      if (fallbackText) {
        text = fallbackText
        await emitStreamText(
          handlers,
          fallbackText,
          fallbackText
        )
      }
    }
  }

  if (!text) {
    throw new Error('模型没有返回有效的流式回复。')
  }

  return {
    text: text.trim(),
    raw: {
      streamed: true,
      eventCount
    }
  }
}

const VISION_TEST_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zq2sAAAAASUVORK5CYII='

export class OpenAICompatibleProvider
implements ModelProvider {
  id: string
  name: string

  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly model: string
  private readonly maxTokens: number

  constructor(
    options: OpenAICompatibleProviderOptions
  ) {
    this.id = options.id
    this.name = options.name
    this.baseUrl = normalizeBaseUrl(
      options.baseUrl
    )
    this.apiKey = options.apiKey.trim()
    this.model = options.model.trim()
    this.maxTokens = options.maxTokens ?? 2048
  }

  private validateEndpointConfig() {
    if (!this.baseUrl) {
      throw new Error('请填写 API 地址。')
    }

    if (!this.apiKey) {
      throw new Error('请填写 API Key。')
    }
  }

  private validateConfig() {
    this.validateEndpointConfig()

    if (!this.model) {
      throw new Error(
        '请选择或手动填写模型名称。'
      )
    }
  }

  async chat(
    request: ChatRequest
  ): Promise<ChatResponse> {
    this.validateConfig()

    let response: Response

    try {
      response = await fetch(
        buildEndpoint(
          this.baseUrl,
          'chat/completions'
        ),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model:
              request.model || this.model,
            messages: request.messages,
            temperature:
              request.temperature ?? 0.8,
            max_tokens: this.maxTokens,
            stream: false
          }),
          signal: request.signal
        }
      )
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        throw error
      }

      throw new Error(
        error instanceof Error
          ? `网络连接失败：${error.message}`
          : '网络连接失败，请检查 API 地址。'
      )
    }

    const data = await readJsonResponse(
      response
    ) as OpenAIChatCompletionResponse

    if (!response.ok) {
      throw createHttpError(
        response.status,
        extractErrorMessage(data)
      )
    }

    const text = extractAssistantText(
      data.choices?.[0]?.message?.content
    )

    if (!text) {
      throw new Error('模型没有返回有效回复。')
    }

    return {
      text,
      raw: data
    }
  }

  async chatStream(
    request: ChatRequest,
    handlers?: ChatStreamHandlers
  ): Promise<ChatResponse> {
    this.validateConfig()

    let response: Response

    try {
      response = await fetch(
        buildEndpoint(
          this.baseUrl,
          'chat/completions'
        ),
        {
          method: 'POST',
          headers: {
            Accept: 'text/event-stream, application/json',
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model:
              request.model || this.model,
            messages: request.messages,
            temperature:
              request.temperature ?? 0.8,
            max_tokens: this.maxTokens,
            stream: true
          }),
          signal: request.signal
        }
      )
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        throw error
      }

      throw new Error(
        error instanceof Error
          ? `网络连接失败：${error.message}`
          : '网络连接失败，请检查 API 地址。'
      )
    }

    if (!response.ok) {
      const raw = await response.text()
      const data = parseJsonSafely(raw)
      const providerMessage =
        extractErrorMessage(data) ||
        raw.trim().slice(0, 500)

      throw createHttpError(
        response.status,
        providerMessage
      )
    }

    const contentType =
      response.headers.get('content-type')?.toLowerCase() ?? ''

    if (contentType.includes('application/json')) {
      const data = await readJsonResponse(
        response
      ) as OpenAIChatCompletionResponse

      const text = extractAssistantText(
        data.choices?.[0]?.message?.content
      )

      if (!text) {
        throw new Error('模型没有返回有效回复。')
      }

      await emitStreamText(
        handlers,
        text,
        text
      )

      return {
        text,
        raw: data
      }
    }

    return readEventStream(
      response,
      handlers
    )
  }

  async listModels(): Promise<ProviderModel[]> {
    this.validateEndpointConfig()

    let response: Response

    try {
      response = await fetch(
        buildEndpoint(
          this.baseUrl,
          'models'
        ),
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization:
              `Bearer ${this.apiKey}`
          }
        }
      )
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `网络连接失败：${error.message}`
          : '网络连接失败，请检查 API 地址。'
      )
    }

    const data = await readJsonResponse(
      response
    ) as OpenAIModelListResponse

    if (!response.ok) {
      throw createHttpError(
        response.status,
        extractErrorMessage(data)
      )
    }

    const models = parseModelEntries(data)

    if (models.length === 0) {
      throw new Error(
        '接口已连接，但没有返回可用模型列表。请改用手动填写。'
      )
    }

    return models
  }

  async testConnection(): Promise<boolean> {
    await this.chat({
      model: this.model,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: '请只回复“连接成功”。'
        }
      ]
    })

    return true
  }

  async testVision(): Promise<boolean> {
    await this.chat({
      model: this.model,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '这是一张极小的测试图片。请只回复“图片可读”。'
            },
            {
              type: 'image_url',
              image_url: {
                url: VISION_TEST_IMAGE,
                detail: 'low'
              }
            }
          ]
        }
      ]
    })

    return true
  }
}
