from your_app.main import greet


def test_greeting_pass():
    """
    A simple test that should pass.
    """
    assert greet("Jules") == "Hello, Jules!"

def test_greeting_fail():
    """
    A simple test that should fail.
    """
    assert greet("Jules") == "This will fail"
