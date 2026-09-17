<script setup lang="ts">
import PhoneFrame from '../components/PhoneFrame.vue'
</script>
<template>
  <PhoneFrame title="钱包" show-back>
    <section class="wallet-page">
      <div class="wallet-symbol" aria-hidden="true">▣</div>
      <h2>钱包正在筹备</h2>
      <p>知间已经将钱包入口整合到「我」，但支付、余额和转账功能尚未接入。本页不会显示虚构余额或发起真实交易。</p>
      <button type="button" @click="$router.push('/companion/me')">返回「我」</button>
    </section>
  </PhoneFrame>
</template>
<style scoped>
.wallet-page{min-height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:40px 28px;color:#34495b;background:#f7fafb;text-align:center}.wallet-symbol{display:grid;place-items:center;width:72px;height:72px;border-radius:20px;background:#e8f7ed;color:#20b977;font-size:48px}.wallet-page h2{font-size:19px;margin:20px 0 6px}.wallet-page p{font-size:13px;color:#8193a1;line-height:1.8;max-width:290px}.wallet-page button{border:1px solid #dce8e1;background:#fff;border-radius:9px;color:#279a65;margin-top:12px;padding:10px 20px;cursor:pointer}
</style>
