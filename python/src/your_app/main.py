def greet(name: str) -> str:
    return f"Hello, {name}!"

if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "world"
    print(greet(target))
