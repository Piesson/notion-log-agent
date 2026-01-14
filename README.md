# notion-log-agent

Claude Code에서 사용하는 통합 Notion 저장 스크립트

## 사용법

```bash
# 새 페이지 생성
node index.js <category> "제목" "내용"

# 기존 페이지에 내용 추가
node index.js append <pageId> "추가할 내용"

# 페이지 검색
node index.js search "검색어"
```

## 카테고리

| 별칭 | 설명 | 접두사 |
|------|------|--------|
| `coding` | 코딩로그 | 📝 [코딩로그] |
| `ai-tech` | AI/기술 뉴스레터 | - |
| `startup` | 스타트업 관련 | - |
| `marketing` | 마케팅 관련 | - |
| `others` | 기타 | - |

## 예시

```bash
# 코딩로그에 저장
node index.js coding "새 기능 구현" "## 내용\n상세 설명..."

# AI-Tech에 저장
node index.js ai-tech "GPT-5 뉴스" "요약 내용"

# 파이프로 마크다운 전달
cat report.md | node index.js startup "리포트 제목"

# 검색
node index.js search "검색어"

# 기존 페이지에 내용 추가 (append)
node index.js append 2e8c5c69a2df81dd "## 추가 섹션\n내용..."
cat extra.md | node index.js append 2e8c5c69a2df81dd
```

## pageId 찾는 방법

1. **노션 URL에서 추출**: `https://notion.so/제목-2e8c5c69a2df81dd...` → `2e8c5c69a2df81dd...`
2. **search 명령 사용**: `node index.js search "제목"` → ID 출력됨
