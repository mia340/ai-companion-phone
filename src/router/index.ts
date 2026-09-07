import {
  createRouter,
  createWebHashHistory
} from 'vue-router'

import LockScreen from '../views/LockScreen.vue'
import HomeScreen from '../views/HomeScreen.vue'
import ChatList from '../views/ChatList.vue'
import ChatRoom from '../views/ChatRoom.vue'
import ContactsView from '../views/ContactsView.vue'
import CharacterCreate from '../views/CharacterCreate.vue'
import CharacterDetailView from '../views/CharacterDetailView.vue'
import CharacterEditView from '../views/CharacterEditView.vue'
import CharacterCardEditorView from '../views/CharacterCardEditorView.vue'
import UserProfileView from '../views/UserProfileView.vue'
import DataBackupView from '../views/DataBackupView.vue'
import SettingsView from '../views/SettingsView.vue'
import ModelSettingsView from '../views/ModelSettingsView.vue'
import PersonaManagerView from '../views/PersonaManagerView.vue'
import LorebookView from '../views/LorebookView.vue'
import WorldCenterView from '../views/WorldCenterView.vue'
import PromptDebugView from '../views/PromptDebugView.vue'
import MemoryManagerView from '../views/MemoryManagerView.vue'
import PlaceholderApp from '../views/PlaceholderApp.vue'

// 新增的重交互 App 按路由懒加载，避免朋友圈/音乐/海龟汤全部挤进首屏主包。
const MomentsView = () => import('../views/MomentsView.vue')
const TurtleSoupView = () => import('../views/TurtleSoupView.vue')
const TurtleSoupHostView = () => import('../views/TurtleSoupHostView.vue')
const MusicAppView = () => import('../views/MusicAppView.vue')

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
      path: '/chat',
      component: ChatList
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
      path: '/app/:name',
      component: PlaceholderApp
    }
  ]
})