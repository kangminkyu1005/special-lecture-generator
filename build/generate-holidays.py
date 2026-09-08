"""Regenerate checked-in Korean holiday candidates; not needed to run the app."""
import json
from pathlib import Path
import holidays

root = Path(__file__).resolve().parent.parent
result = {}
for year in range(2020, 2046):
    calendar = holidays.KR(years=year, language='ko')
    result[str(year)] = [{'date': str(date), 'name': name} for date, name in sorted(calendar.items())]
(root / 'outputs' / 'korean-holidays.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result['2026'], ensure_ascii=False))
