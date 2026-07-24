import { createRouter, createWebHistory } from 'vue-router'
import LockScreen from '../views/LockScreen.vue'
import HomeScreen from '../views/HomeScreen.vue'
import ChatList from '../views/ChatList.vue'
import ChatRoom from '../views/ChatRoom.vue'
import ContactsView from '../views/ContactsView.vue'
import CharacterCreate from '../views/CharacterCreate.vue'
import SettingsView from '../views/SettingsView.vue'
import PlaceholderApp from '../views/PlaceholderApp.vue'
import UserProfileView from '../views/UserProfileView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: LockScreen },
    { path: '/home', component: HomeScreen },
    { path: '/chat', component: ChatList },
    { path: '/chat/:id', component: ChatRoom },
    { path: '/contacts', component: ContactsView },
    { path: '/characters/new', component: CharacterCreate },
    { path: '/profile',component: UserProfileView},
    { path: '/settings', component: SettingsView },
    { path: '/app/:name', component: PlaceholderApp }
  ]
})
