#path for virtual environment is not correctly 
import sys
import os
venv_path = os.path.abspath('/Applications/XAMPP/xamppfiles/htdocs/NolTo/venv/lib/python3.9/site-packages')
if venv_path not in sys.path:
    sys.path.insert(0, venv_path)
#I have no idea if this is a good practice.
import lyricsgenius

def main():
    # Check if the correct number of arguments are provided
    if len(sys.argv) != 3:
        print("Usage: python example.py <arg1> <arg2>")
        sys.exit(1)

    # Access the command-line arguments
    arg1 = sys.argv[1]
    arg2 = sys.argv[2]

    client_access_token = "IcG7poffLAlsVROHP6evD9ICPxLhuyWcPSG5nm-JQeGE8I-50kROlMKPI6xElvJY"

    LyricsGenius = lyricsgenius.Genius(client_access_token)
    song = LyricsGenius.search_song(arg1, arg2)

    print(song.lyrics)


if __name__ == "__main__":
    main()



