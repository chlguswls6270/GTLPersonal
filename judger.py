#path for virtual environment is not correctly 
import sys
import os
# venv_path = os.path.abspath('/Applications/XAMPP/xamppfiles/htdocs/NolTo/venv/lib/python3.9/site-packages')
# if venv_path not in sys.path:
#     sys.path.insert(0, venv_path)
#I have no idea if this is a good practice.

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

def main():
    if len(sys.argv) != 3:
        print("Usage: python example.py <arg1> <arg2>")
        sys.exit(1)
    
    # Function to calculate sentence similarity in percentage
    def calculate_similarity_percentage(sentence1, sentence2):
        # Create the Document Term Matrix using TfidfVectorizer
        tfidf_vectorizer = TfidfVectorizer()
        tfidf_matrix = tfidf_vectorizer.fit_transform([sentence1, sentence2])
        
        # Calculate cosine similarity
        cosine_sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])
        
        # Convert similarity to percentage
        similarity_percentage = cosine_sim[0][0] * 100
        return similarity_percentage

    #access command-line argument
    sentence1 = sys.argv[1]
    sentence2 = sys.argv[2]

    # Calculate similarity
    similarity = calculate_similarity_percentage(sentence1, sentence2)
    print(f"Similarity: {similarity:.2f}%")

if __name__ == "__main__":
    main()
