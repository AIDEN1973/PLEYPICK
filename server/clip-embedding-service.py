#!/usr/bin/env python3
"""
CLIP 임베딩 서비스 (FastAPI)
- ViT-L/14 모델 사용, 768차원 출력
- L2 정규화 적용
- OpenAI API와 동일한 인터페이스 제공
"""

import os
import sys
import json
import asyncio
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch
from transformers import CLIPProcessor, CLIPModel
import numpy as np
from pydantic import BaseModel
from PIL import Image
import base64
from io import BytesIO

# 모델 로드 (전역)
device = "cuda" if torch.cuda.is_available() else "cpu"
model = None
processor = None

class EmbeddingRequest(BaseModel):
    input: str
    model: str = "clip-vit-l/14"
    dimensions: int = 768

class ImageEmbeddingRequest(BaseModel):
    image_base64: str
    model: str = "clip-vit-l/14"
    dimensions: int = 768

class EmbeddingResponse(BaseModel):
    object: str = "list"
    data: List[Dict[str, Any]]
    model: str
    usage: Dict[str, int]

async def load_clip_model():
    """CLIP 모델 로드 (transformers 사용)"""
    global model, processor
    try:
        print(f"Loading CLIP ViT-L/14 on {device}...")
        model = CLIPModel.from_pretrained("openai/clip-vit-large-patch14").to(device)
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-large-patch14")
        print("CLIP model loaded successfully")
        return True
    except Exception as e:
        print(f"Failed to load CLIP model: {e}")
        return False

async def generate_clip_embedding(text: str) -> List[float]:
    """CLIP 텍스트 임베딩 생성 (768차원, L2 정규화)"""
    if not model or not processor:
        raise HTTPException(status_code=500, detail="CLIP model not loaded")
    
    try:
        # 텍스트 토큰화 (transformers 사용)
        inputs = processor(text=[text], return_tensors="pt", padding=True, truncation=True).to(device)
        
        # 임베딩 생성
        with torch.no_grad():
            text_features = model.get_text_features(**inputs)
            # L2 정규화 (OpenAI 스타일)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        
        # CPU로 이동 후 리스트 변환
        embedding = text_features.cpu().numpy()[0].tolist()
        
        # 차원 검증
        if len(embedding) != 768:
            raise ValueError(f"Expected 768 dimensions, got {len(embedding)}")
        
        return embedding
        
    except Exception as e:
        print(f"CLIP embedding generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

async def generate_clip_image_embedding(image_base64: str) -> List[float]:
    """CLIP 이미지 임베딩 생성 (768차원, L2 정규화)"""
    if not model or not processor:
        raise HTTPException(status_code=500, detail="CLIP model not loaded")
    
    try:
        # base64 디코딩
        if image_base64.startswith('data:image'):
            # data:image/png;base64,xxx 형식 처리
            image_base64 = image_base64.split(',')[1]
        
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data)).convert('RGB')
        
        # [FIX] 수정됨: 이미지 크기 검증 (너무 작은 이미지 방지)
        width, height = image.size
        if width < 1 or height < 1:
            raise ValueError(f"Image size too small: {width}x{height}")
        if width > 10000 or height > 10000:
            raise ValueError(f"Image size too large: {width}x{height}")
        
        # [FIX] 수정됨: 최소 크기 보장 (1x1 같은 경우 리사이즈) - 크롭 품질 개선
        min_size = 128  # 64 → 128 (더 나은 임베딩 품질, 근본 원인 해결)
        if width < min_size or height < min_size:
            # 작은 이미지는 최소 크기로 리사이즈 (비율 유지)
            if width < height:
                new_width = min_size
                new_height = int(height * (min_size / width))
            else:
                new_height = min_size
                new_width = int(width * (min_size / height))
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            print(f"[WARNING] Image resized from {width}x{height} to {new_width}x{new_height} (min_size: {min_size})")
        
        # 이미지 전처리
        # [FIX] 수정됨: processor 호출 시 명시적으로 이미지 리스트 전달
        try:
            inputs = processor(images=[image], return_tensors="pt", padding=True).to(device)
        except Exception as proc_error:
            # 전처리 오류 시 상세 정보 출력
            print(f"[ERROR] Image preprocessing failed: {proc_error}")
            print(f"[ERROR] Image size: {image.size}, mode: {image.mode}")
            raise ValueError(f"Image preprocessing failed: {str(proc_error)}")
        
        # 임베딩 생성
        with torch.no_grad():
            image_features = model.get_image_features(**inputs)
            # L2 정규화 (OpenAI 스타일)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        
        # CPU로 이동 후 리스트 변환
        embedding = image_features.cpu().numpy()[0].tolist()
        
        # 차원 검증
        if len(embedding) != 768:
            raise ValueError(f"Expected 768 dimensions, got {len(embedding)}")
        
        return embedding
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        print(f"CLIP image embedding generation failed: {error_msg}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Image embedding generation failed: {error_msg}")

# Lifespan 이벤트 핸들러 (FastAPI 최신 방식)
@asynccontextmanager
async def lifespan(app: FastAPI):
    """서비스 시작/종료 시 실행"""
    # 시작 시 모델 로드
    success = await load_clip_model()
    if not success:
        print("[ERROR] Failed to load CLIP model, service may not work properly")
    yield
    # 종료 시 정리 작업 (필요시)

# FastAPI 앱 생성
app = FastAPI(
    title="CLIP Embedding Service",
    description="CLIP ViT-L/14 기반 768차원 임베딩 서비스",
    version="1.0.0",
    lifespan=lifespan # [FIX] 수정됨: lifespan event handlers 사용
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """헬스 체크"""
    model_loaded = model is not None and processor is not None
    return {
        "status": "healthy" if model_loaded else "unhealthy",
        "model": "clip-vit-l/14",
        "device": device,
        "dimensions": 768,
        "model_loaded": model_loaded
    }

@app.post("/v1/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    """임베딩 생성 엔드포인트 (OpenAI API 호환)"""
    try:
        # 입력 검증
        if not request.input or not request.input.strip():
            raise HTTPException(status_code=400, detail="Input text is required")
        
        # 차원 검증 (CLIP ViT-L/14는 768차원 고정)
        if request.dimensions != 768:
            print(f"[WARNING] Requested {request.dimensions} dimensions, using 768 (CLIP ViT-L/14)")
        
        # 임베딩 생성
        embedding = await generate_clip_embedding(request.input.strip())
        
        # OpenAI API 형식으로 응답
        response = EmbeddingResponse(
            data=[{
                "object": "embedding",
                "index": 0,
                "embedding": embedding
            }],
            model="clip-vit-l/14",
            usage={
                "prompt_tokens": len(request.input.split()),
                "total_tokens": len(request.input.split())
            }
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Embedding request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/v1/image-embeddings")
async def create_image_embeddings(request: ImageEmbeddingRequest):
    """이미지 임베딩 생성 엔드포인트"""
    try:
        # 입력 검증
        if not request.image_base64 or not request.image_base64.strip():
            raise HTTPException(status_code=400, detail="image_base64 is required")
        
        # 차원 검증 (CLIP ViT-L/14는 768차원 고정)
        if request.dimensions != 768:
            print(f"[WARNING] Requested {request.dimensions} dimensions, using 768 (CLIP ViT-L/14)")
        
        # 이미지 임베딩 생성
        embedding = await generate_clip_image_embedding(request.image_base64.strip())
        
        # OpenAI API 형식으로 응답
        return {
            "object": "list",
            "data": [{
                "object": "embedding",
                "index": 0,
                "embedding": embedding
            }],
            "model": "clip-vit-l/14",
            "usage": {
                "prompt_tokens": 0,
                "total_tokens": 0
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Image embedding request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/")
@app.head("/")
async def root():
    """루트 엔드포인트 (GET/HEAD 지원)"""
    return {
        "service": "CLIP Embedding Service",
        "version": "1.0.0",
        "model": "clip-vit-l/14",
        "dimensions": 768,
        "endpoints": {
            "health": "/health",
            "embeddings": "/v1/embeddings",
            "image_embeddings": "/v1/image-embeddings"
        }
    }

if __name__ == "__main__":
    # 고정 포트 3021 사용 (근본 문제 해결)
    port = 3021
    host = "0.0.0.0"
    
    print(f"Starting CLIP Embedding Service on {host}:{port}")
    print(f"Model: CLIP ViT-L/14, Device: {device}")
    print(f"Dimensions: 768")
    
    uvicorn.run(
        "clip-embedding-service:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )
