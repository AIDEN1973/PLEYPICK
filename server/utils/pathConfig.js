import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import dotenv from 'dotenv'

// 환경 변수 로드
dotenv.config({ path: path.join(process.cwd(), 'config', 'synthetic_dataset.env') })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 합성 데이터셋 루트 경로 조회
 * 환경 변수 BRICKBOX_SYNTHETIC_ROOT 또는 SYNTHETIC_OUTPUT_DIR 사용
 * 기본값: 프로젝트 루트/output/synthetic
 */
export function getSyntheticRoot() {
  // 1순위: 환경 변수 BRICKBOX_SYNTHETIC_ROOT (절대 경로)
  const envRoot = process.env.BRICKBOX_SYNTHETIC_ROOT || process.env.SYNTHETIC_OUTPUT_DIR
  
  if (envRoot) {
    // 절대 경로인 경우 그대로 사용
    if (path.isAbsolute(envRoot)) {
      return envRoot
    }
    // 상대 경로인 경우 프로젝트 루트 기준으로 해석
    return path.resolve(process.cwd(), envRoot)
  }
  
  // 기본값: 프로젝트 루트/output/synthetic
  return path.join(process.cwd(), 'output', 'synthetic')
}

/**
 * dataset_synthetic 경로 조회
 * {synthetic_root}/dataset_synthetic
 */
export function getDatasetSyntheticPath() {
  return path.join(getSyntheticRoot(), 'dataset_synthetic')
}

/**
 * 특정 부품의 dataset_synthetic 경로 조회
 * {synthetic_root}/dataset_synthetic/{element_id}
 */
export function getPartDatasetPath(elementId) {
  return path.join(getDatasetSyntheticPath(), elementId)
}

/**
 * 특정 부품의 images 경로 조회
 * {synthetic_root}/dataset_synthetic/{element_id}/images
 */
export function getPartImagesPath(elementId) {
  return path.join(getPartDatasetPath(elementId), 'images')
}

/**
 * 특정 부품의 labels 경로 조회
 * {synthetic_root}/dataset_synthetic/{element_id}/labels
 */
export function getPartLabelsPath(elementId) {
  return path.join(getPartDatasetPath(elementId), 'labels')
}

/**
 * 특정 부품의 meta 경로 조회
 * {synthetic_root}/dataset_synthetic/{element_id}/meta
 */
export function getPartMetaPath(elementId) {
  return path.join(getPartDatasetPath(elementId), 'meta')
}

/**
 * 특정 부품의 meta-e 경로 조회
 * {synthetic_root}/dataset_synthetic/{element_id}/meta-e
 */
export function getPartMetaEPath(elementId) {
  return path.join(getPartDatasetPath(elementId), 'meta-e')
}

/**
 * 특정 부품의 depth 경로 조회
 * {synthetic_root}/dataset_synthetic/{element_id}/depth
 */
export function getPartDepthPath(elementId) {
  return path.join(getPartDatasetPath(elementId), 'depth')
}

/**
 * 경로가 존재하는지 확인하고 없으면 생성
 */
export function ensurePathExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
  return dirPath
}

/**
 * 합성 데이터셋 루트 경로 초기화 (필요한 폴더 생성)
 */
export function initializeSyntheticPaths() {
  const root = getSyntheticRoot()
  ensurePathExists(root)
  ensurePathExists(getDatasetSyntheticPath())
  return root
}

