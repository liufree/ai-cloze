---
tags:
  - demo
  - cloze
---

# AI 挖空阅读 · 演示笔记

本笔记用于演示 ai-cloze 插件的挖空效果：打开命令面板，执行「打开当前笔记的 AI 挖空阅读视图」，AI 会自动识别文中的关键知识点并挖空，点击挖空词即可显示/隐藏答案。

## 基本概念

Python 是一种解释型高级编程语言，由 Guido van Rossum 于 1991 年创建。其设计哲学强调代码可读性，使用缩进来划分代码块。

## 数据结构

Python 的常用内建数据结构包括：

| 类型 | 特性 | 示例 |
| --- | --- | --- |
| 列表（list） | 有序、可变 | `[1, 2, 3]` |
| 元组（tuple） | 有序、不可变 | `(1, 2, 3)` |
| 字典（dict） | 键值对映射 | `{"a": 1}` |
| 集合（set） | 无序、不重复 | `{1, 2, 3}` |

## 重点公式

欧拉公式：$e^{i\pi} + 1 = 0$，其中 $e$ 是自然对数的底，$i$ 是虚数单位，$\pi$ 是圆周率。这一公式被数学家称为「最美丽的数学公式」。

## 示例代码

```python
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)
```

## 关键术语

- **解释型语言**：代码在执行时逐行翻译，无需预先编译
- **缩进**：Python 用缩进表示代码块的层级关系
- **欧拉公式**：连接指数函数与三角函数的桥梁

> [!tip]
> 挖空密度可在视图内用滑杆实时调节；已生成的挖空会按笔记缓存，下次打开直接读取，只有点击「重新 AI 挖空」才会再次调用 AI。