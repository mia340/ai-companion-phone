import {
  createRouter,
  createWebHashHistory
} from 'vue-router'

import LockScreen from '../views/LockScreen.vue'
import HomeScreen from '../views/HomeScreen.vue'
import ChatList from '../views/ChatList.vue'
import ChatRoom from '../views/ChatRoom.vue'
// V1.2: only the lock/home/chat shells stay eager. Editors, settings and secondary apps are route chunks.
const ContactsView = () => import('../views/ContactsView.vue')
const CharacterCreate = () => import('../views/CharacterCreate.vue')
const CharacterDetailView = () => import('../views/CharacterDetailView.vue')
const CharacterEditView = () => import('../views/CharacterEditView.vue')
const CharacterCardEditorView = () => import('../views/CharacterCardEditorView.vue')
const UserProfileView = () => import('../views/UserProfileView.vue')
const CompanionMeView = () => import('../views/CompanionMeView.vue')
const CompanionDiscoverView = () => import('../views/CompanionDiscoverView.vue')
const CompanionWalletView = () => import('../views/CompanionWalletView.vue')
const CompanionSpaceSettingsView = () => import('../views/CompanionSpaceSettingsView.vue')
const CompanionSpacePeopleView = () => import('../views/CompanionSpacePeopleView.vue')
const DataBackupView = () => import('../views/DataBackupView.vue')
const SettingsView = () => import('../views/SettingsView.vue')
const AppearanceSettingsView = () => import('../views/AppearanceSettingsView.vue')
const ModelSettingsView = () => import('../views/ModelSettingsView.vue')
const PersonaManagerView = () => import('../views/PersonaManagerView.vue')
const LorebookView = () => import('../views/LorebookView.vue')
const WorldCenterView = () => import('../views/WorldCenterView.vue')
const PromptDebugView = () => import('../views/PromptDebugView.vue')
const MemoryManagerView = () => import('../views/MemoryManagerView.vue')
const MemoryCenterView = () => import('../views/MemoryCenterView.vue')

// 重交互 App 按路由懒加载，避免朋友圈/音乐/海龟汤/飞行棋挤进首屏主包。
const MomentsView = () => import('../views/MomentsView.vue')
const MomentNotificationsView = () => import('../views/MomentNotificationsView.vue')
const MomentSettingsView = () => import('../views/MomentSettingsView.vue')
const MomentCharacterSocialView = () => import('../views/MomentCharacterSocialView.vue')
const TurtleSoupView = () => import('../views/TurtleSoupView.vue')
const TurtleSoupHostView = () => import('../views/TurtleSoupHostView.vue')
const MusicAppView = () => import('../views/MusicAppView.vue')
const SharedTimelineView = () => import('../views/SharedTimelineView.vue')
const CoupleBoardView = () => import('../views/CoupleBoardView.vue')
const CoupleBoardLibraryView = () => import('../views/CoupleBoardLibraryView.vue')

export const router = createRouter({
  history: createWebHashHistory(),

  routes: [
    {
      path: '/',
      component: LockScreen
    },
    {
      path: '/home',
      component: HomeScreen
    },
    {
      path: '/companion',
      redirect: '/chat'
    },
    {
      path: '/companion/discover',
      component: CompanionDiscoverView
    },
    {
      path: '/companion/me',
      component: CompanionMeView
    },
    {
      path: '/companion/wallet',
      component: CompanionWalletView
    },
    {
      path: '/companion/space-settings',
      component: CompanionSpaceSettingsView
    },
    {
      path: '/companion/space-settings/people',
      component: CompanionSpacePeopleView
    },
    {
      path: '/chat',
      component: ChatList
    },
    {
      path: '/memory',
      component: MemoryCenterView
    },
    {
      path: '/chat/:id/debug',
      component: PromptDebugView
    },
    {
      path: '/chat/:id/memory',
      component: MemoryManagerView
    },
    {
      path: '/chat/:id',
      component: ChatRoom
    },
    {
      path: '/contacts',
      component: ContactsView
    },

    // 固定地址必须放在动态地址前
    {
      path: '/characters/new',
      component: CharacterCreate
    },
    {
      path: '/characters/:id/edit',
      component: CharacterEditView
    },
    {
      path: '/characters/:id/card',
      component: CharacterCardEditorView
    },
    {
      path: '/characters/:id',
      component: CharacterDetailView
    },

    {
      path: '/profile',
      component: UserProfileView
    },
    {
      path: '/backup',
      component: DataBackupView
    },
    {
      path: '/settings/appearance',
      component: AppearanceSettingsView
    },
    {
      path: '/settings/models',
      component: ModelSettingsView
    },
    {
      path: '/settings/personas',
      component: PersonaManagerView
    },
    {
      path: '/world',
      component: WorldCenterView
    },
    {
      path: '/settings/lorebook',
      component: LorebookView
    },
    {
      path: '/settings',
      component: SettingsView
    },
    {
      path: '/app/朋友圈',
      component: MomentsView
    },
    {
      path: '/app/朋友圈/notifications',
      component: MomentNotificationsView
    },
    {
      path: '/app/朋友圈/settings',
      component: MomentSettingsView
    },
    {
      path: '/app/朋友圈/settings/character/:id',
      component: MomentCharacterSocialView
    },
    {
      path: '/app/海龟汤',
      component: TurtleSoupView
    },
    {
      path: '/app/海龟汤/主持',
      component: TurtleSoupHostView
    },
    {
      path: '/app/音乐',
      component: MusicAppView
    },
    {
      path: '/app/时光',
      component: SharedTimelineView
    },
    {
      path: '/app/心跳飞行棋/library',
      component: CoupleBoardLibraryView
    },
    {
      path: '/app/心跳飞行棋',
      component: CoupleBoardView
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/home'
    }
  ]
})
