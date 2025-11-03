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
from typing import List, Dict, Any
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch
from transformers import CLIPProcessor, CLIPModel
import numpy as np
from pydantic import BaseModel

# 모델 로드 (전역)
device = "cuda" if torch.cuda.is_available() else "cpu"
model = None
processor = None

class EmbeddingRequest(BaseModel):
    input: str
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

# FastAPI 앱 생성
app = FastAPI(
    title="CLIP Embedding Service",
    description="CLIP ViT-L/14 기반 768차원 임베딩 서비스",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """서비스 시작 시 모델 로드"""
    success = await load_clip_model()
    if not success:
        print("[ERROR] Failed to load CLIP model, service may not work properly")

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
            "embeddings": "/v1/embeddings"
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
