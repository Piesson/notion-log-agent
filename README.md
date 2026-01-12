# notion-log-agent

Claude Code에서 사용하는 통합 Notion 저장 스크립트

## 사용법

```bash
node index.js <category> "제목" "내용"
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
```
