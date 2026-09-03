---
title: '로그를 더 남기려다 경고를 잃다 — 파이썬 lastResort'
description: '파일 로깅을 붙였더니 콘솔에서 경고가 사라졌다. 로그를 늘리는 변경이 오히려 눈에 보이던 것을 없앤 이유와, 파이썬 로깅의 lastResort 동작.'
pubDate: 'Sep 03 2026'
---

컨테이너를 다시 만들면 로그가 사라지는 게 불편했다. 그래서 파일에도 함께 남기기로 했다.

```python
handler = RotatingFileHandler("app.log", maxBytes=10*1024*1024, backupCount=5)
handler.setFormatter(logging.Formatter(FMT))

root = logging.getLogger()
root.setLevel(logging.INFO)
root.addHandler(handler)
```

파일에는 잘 쌓였다. 그런데 며칠 뒤 이상한 걸 발견했다. **기동할 때 나오던 환경 점검 경고가 `docker compose logs` 에 한 줄도 안 나왔다.**

## 확인

같은 코드를 두 조건으로 돌려 비교했다.

```python
logging.getLogger("app.diagnostics").warning("기본 비밀번호 사용 중")
logging.getLogger("app.diagnostics").error("마이그레이션 미적용")
```

| | 콘솔 | 파일 |
|---|---:|---:|
| 파일 핸들러 붙이기 **전** | 2줄 | — |
| 파일 핸들러 붙인 **후** | **0줄** | 2줄 |

로그를 더 남기려는 변경이 **원래 보이던 경고를 없앴다.**

## 원인 — lastResort

파이썬 로깅에는 `logging.lastResort` 라는 장치가 있다. 핸들러를 하나도 설정하지 않은 프로그램에서도 심각한 메시지는 놓치지 않도록, **stderr로 WARNING 이상을 출력하는 최후의 핸들러**다.

동작 조건이 핵심이다. `Logger.callHandlers` 를 보면 이렇다.

```python
if found == 0:
    if lastResort:
        if record.levelno >= lastResort.level:
            lastResort.handle(record)
```

**전파 경로를 따라 올라가며 핸들러를 하나도 못 찾았을 때만** 동작한다.

원래 이 앱은 루트에 핸들러가 없었다. 그래서 `app.*` 로거의 경고가 전파 경로 끝까지 가서 핸들러를 못 찾았고, `lastResort` 가 stderr로 뱉어줬다. 그게 우리가 보던 경고였다.

그런데 루트에 파일 핸들러를 붙이자 `found` 가 0이 아니게 됐다. **조건이 깨지면서 `lastResort` 가 조용히 물러났다.** 경고는 파일로만 갔다.

```
[변경 전]  app.diagnostics → 루트(핸들러 없음) → lastResort → stderr ✅
[변경 후]  app.diagnostics → 루트(파일 핸들러) → 파일          ← 콘솔 없음
```

오류도 예외도 나지 않는다. **아무 신호 없이 가시성만 사라진다.**

## 해결

루트에 콘솔 핸들러를 명시적으로 붙였다. 우연히 동작하던 `lastResort` 에 기대지 말고, 필요한 출력을 직접 설정하는 것이다.

```python
root = logging.getLogger()
root.setLevel(logging.INFO)

console = logging.StreamHandler(sys.stdout)
console.setFormatter(logging.Formatter(FMT))
root.addHandler(console)

# 파일 핸들러는 그 뒤에
```

**순서에 이유가 있다.** 콘솔을 먼저 붙여야, 파일 준비가 실패했을 때 그 사실도 콘솔에 남는다. 반대로 하면 "파일 로깅을 켜지 못했습니다" 라는 경고 자체를 놓친다.

## 함정 하나 더

setup 이 두 번 호출돼도 중복되지 않게 하려고 이렇게 검사하면 틀린다.

```python
if not any(isinstance(h, logging.StreamHandler) for h in root.handlers):
    root.addHandler(console)
```

**`FileHandler` 는 `StreamHandler` 의 하위 클래스다.** 파일 핸들러가 이미 붙어 있으면 이 검사가 참이 되어, 콘솔 핸들러가 영영 안 붙는다.

```python
def has_console(lg):
    return any(
        isinstance(h, logging.StreamHandler) and not isinstance(h, logging.FileHandler)
        for h in lg.handlers
    )
```

`RotatingFileHandler` → `FileHandler` → `StreamHandler` 순으로 상속되므로, 파일 계열을 명시적으로 제외해야 한다.

## 정리

- `lastResort` 는 **핸들러가 하나도 없을 때만** 동작한다. 핸들러를 하나라도 붙이면 물러난다
- 그래서 로깅을 추가하는 변경이 기존 출력을 없앨 수 있다. 오류가 나지 않아 발견이 늦다
- 콘솔 출력이 필요하면 `lastResort` 에 기대지 말고 `StreamHandler` 를 직접 붙인다
- 중복 검사에서 `FileHandler` 는 `StreamHandler` 의 하위 클래스라는 점에 주의한다

**안전장치는 보여야 작동한다.** 파일에만 남는 경고는 열어보지 않으면 없는 것과 같다.
