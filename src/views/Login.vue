<template>
  <div class="login-container">
    <div class="login-card">
      <h2>로그인</h2>
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="email">이메일</label>
          <input
            type="email"
            id="email"
            v-model="email"
            required
            placeholder="이메일을 입력하세요"
          />
        </div>
        <div class="form-group">
          <label for="password">비밀번호</label>
          <input
            type="password"
            id="password"
            v-model="password"
            required
            placeholder="비밀번호를 입력하세요"
          />
        </div>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? '로그인 중...' : '로그인' }}
        </button>
      </form>
      
      <div class="divider">
        <span>또는</span>
      </div>
      
      <form @submit.prevent="handleSignUp" class="signup-form">
        <h3>새 계정 만들기</h3>
        <div class="form-group">
          <label for="signup-email">이메일</label>
          <input
            type="email"
            id="signup-email"
            v-model="signupEmail"
            required
            placeholder="이메일을 입력하세요"
          />
        </div>
        <div class="form-group">
          <label for="signup-password">비밀번호</label>
          <input
            type="password"
            id="signup-password"
            v-model="signupPassword"
            required
            placeholder="비밀번호를 입력하세요"
            minlength="6"
          />
        </div>
        <button type="submit" class="btn btn-secondary" :disabled="loading">
          {{ loading ? '가입 중...' : '회원가입' }}
        </button>
      </form>
      
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      <div v-if="success" class="success-message">
        {{ success }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabase } from '../composables/useSupabase'
import { useSupabasePleyon } from '../composables/useSupabasePleyon'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const { signIn, signUp, supabase } = useSupabase()
    const { getStoreInfoByEmail } = useSupabasePleyon()
    
    const email = ref('')
    const password = ref('')
    const signupEmail = ref('')
    const signupPassword = ref('')
    const loading = ref(false)
    const error = ref('')
    const success = ref('')

    const handleLogin = async () => {
      loading.value = true
      error.value = ''
      
      const { data, error: loginError } = await signIn(email.value, password.value)
      
      if (loginError) {
        error.value = loginError.message
        loading.value = false
        return
      }

      if (data?.user) {
        // 관리자 확인
        const { data: adminData } = await supabase
          .from('admin_users')
          .select('id, role, is_active, email')
          .eq('email', data.user.email)
          .eq('is_active', true)
          .maybeSingle()

        const isAdmin = adminData && (adminData.role === 'admin' || adminData.role === 'super_admin')

        const storeInfo = await getStoreInfoByEmail(data.user.email)
        if (storeInfo) {
          const { store } = storeInfo
          const { error: storeSyncError } = await supabase
            .from('stores')
            .upsert({
              id: store.id,
              name: store.name,
              location: store.address || null,
              contact: store.store_phone || store.owner_phone || null,
              status: store.is_active ? 'active' : 'inactive',
              config: {
                pleyon_store_id: store.id,
                owner_name: store.store_owner_name,
                owner_phone: store.owner_phone
              },
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            })

          if (storeSyncError) {
            console.error('[Login] 매장 정보 동기화 실패:', storeSyncError)
          } else {
            // users 테이블 업데이트
            const updateData = {
              store_id: store.id,
              updated_at: new Date().toISOString()
            }
            
            // 관리자가 아니면 role 업데이트, 관리자면 role은 admin 유지
            if (!isAdmin) {
              updateData.role = storeInfo.storeUserRole === 'owner' ? 'store_owner' : 'store_manager'
            } else {
              updateData.role = 'admin'
            }

            const { error: userUpdateError } = await supabase
              .from('users')
              .update(updateData)
              .eq('id', data.user.id)

            if (userUpdateError) {
              console.error('[Login] 사용자 정보 업데이트 실패:', userUpdateError)
            } else {
              console.log('[Login] 사용자 정보 업데이트 완료 (role:', updateData.role, ')')
            }
          }
        } else if (isAdmin) {
          // 관리자이지만 매장 정보가 없는 경우 role만 admin으로 업데이트
          const { error: userUpdateError } = await supabase
            .from('users')
            .update({
              role: 'admin',
              updated_at: new Date().toISOString()
            })
            .eq('id', data.user.id)

          if (userUpdateError) {
            console.error('[Login] 관리자 role 업데이트 실패:', userUpdateError)
      } else {
            console.log('[Login] 관리자 role 업데이트 완료')
          }
        }
      }
      
      router.push('/dashboard')
      loading.value = false
    }

    const handleSignUp = async () => {
      loading.value = true
      error.value = ''
      success.value = ''

      const emailToCheck = signupEmail.value.trim()
      if (!emailToCheck) {
        error.value = '이메일을 입력해주세요.'
        loading.value = false
        return
      }

      const storeInfo = await getStoreInfoByEmail(emailToCheck)
      
      const { data, error: signupError } = await signUp(signupEmail.value, signupPassword.value)
      
      if (signupError) {
        error.value = signupError.message
        loading.value = false
        return
      }

      if (data?.user && storeInfo) {
        const { store } = storeInfo
        const { error: storeSyncError } = await supabase
          .from('stores')
          .upsert({
            id: store.id,
            name: store.name,
            location: store.address || null,
            contact: store.store_phone || store.owner_phone || null,
            status: store.is_active ? 'active' : 'inactive',
            config: {
              pleyon_store_id: store.id,
              owner_name: store.store_owner_name,
              owner_phone: store.owner_phone
            },
            registered_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })

        if (storeSyncError) {
          console.error('[SignUp] 매장 정보 등록 실패:', storeSyncError)
          error.value = '매장 정보 등록 중 오류가 발생했습니다.'
          loading.value = false
          return
        }

        // users 테이블의 store_id 업데이트
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({
            store_id: store.id,
            role: storeInfo.storeUserRole === 'owner' ? 'store_owner' : 'store_manager',
            updated_at: new Date().toISOString()
          })
          .eq('id', data.user.id)

        if (userUpdateError) {
          console.error('[SignUp] 사용자 매장 정보 업데이트 실패:', userUpdateError)
        } else {
          console.log('[SignUp] 사용자 매장 정보 업데이트 완료')
        }

        success.value = '회원가입이 완료되었습니다! 매장 정보가 연동되었습니다.'
      } else {
        success.value = '회원가입이 완료되었습니다! 이메일을 확인해주세요.'
      }
      
      signupEmail.value = ''
      signupPassword.value = ''
      loading.value = false
    }

    return {
      email,
      password,
      signupEmail,
      signupPassword,
      loading,
      error,
      success,
      handleLogin,
      handleSignUp
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 2rem;
}

.login-card {
  background: white;
  padding: 3rem;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 500px;
}

.login-card h2 {
  text-align: center;
  margin-bottom: 2rem;
  color: #333;
  font-size: 2rem;
}

.login-form, .signup-form {
  margin-bottom: 2rem;
}

.signup-form h3 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #666;
  font-size: 1.2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #333;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.btn {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #f8f9fa;
  color: #333;
  border: 2px solid #e1e5e9;
}

.btn-secondary:hover:not(:disabled) {
  background: #e9ecef;
}

.divider {
  text-align: center;
  margin: 2rem 0;
  position: relative;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #e1e5e9;
}

.divider span {
  background: white;
  padding: 0 1rem;
  color: #666;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  margin-top: 1rem;
}

.success-message {
  background: #efe;
  color: #363;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  margin-top: 1rem;
}
</style>
