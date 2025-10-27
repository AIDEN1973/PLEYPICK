#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Supabase 설정
const supabaseUrl = 'https://npferbxuxocbfnfbpcnz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testUpload() {
  try {
    console.log('🧪 Supabase Storage 업로드 테스트 시작...')
    
    // 테스트 파일 생성
    const testContent = `테스트 파일 - ${new Date().toISOString()}`
    const testFilePath = 'test_upload.txt'
    fs.writeFileSync(testFilePath, testContent, 'utf8')
    
    console.log('📁 테스트 파일 생성:', testFilePath)
    
    // 업로드 경로 설정
    const uploadPath = 'synthetic/test/upload_test.txt'
    
    console.log('📤 업로드 시작:', uploadPath)
    
    // 파일 읽기
    const fileBuffer = fs.readFileSync(testFilePath)
    
    // Supabase Storage 업로드
    const { data, error } = await supabase.storage
      .from('lego-synthetic')
      .upload(uploadPath, fileBuffer, {
        contentType: 'text/plain',
        upsert: true
      })
    
    if (error) {
      console.error('❌ 업로드 실패:', error)
      return false
    }
    
    console.log('✅ 업로드 성공:', data)
    
    // 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from('lego-synthetic')
      .getPublicUrl(uploadPath)
    
    console.log('🔗 공개 URL:', urlData.publicUrl)
    
    // 파일 다운로드 테스트
    console.log('📥 다운로드 테스트...')
    const response = await fetch(urlData.publicUrl)
    
    if (response.ok) {
      const downloadedContent = await response.text()
      console.log('✅ 다운로드 성공:', downloadedContent)
    } else {
      console.error('❌ 다운로드 실패:', response.status)
    }
    
    // 테스트 파일 정리
    fs.unlinkSync(testFilePath)
    console.log('🗑️ 테스트 파일 정리 완료')
    
    return true
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error)
    return false
  }
}

// 테스트 실행
testUpload()
  .then(success => {
    if (success) {
      console.log('🎉 모든 테스트 통과!')
    } else {
      console.log('💥 테스트 실패!')
    }
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('💥 예상치 못한 오류:', error)
    process.exit(1)
  })
