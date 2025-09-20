def greet(name: str) -> str:
    return f"Well hello there, {name}! What a fine day."

if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "world"
    print(greet(target))
