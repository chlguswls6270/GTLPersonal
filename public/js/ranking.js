let currentPage = 0;
const itemsPerPage = 20;
let rankings;

document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadRankings();
});

function loadUserInfo() {
    // Fetch user info from the server or local storage
    let userInfo = sessionStorage.getItem("userInfo");
    userInfo = JSON.parse(userInfo)
    console.log(userInfo)
    if (userInfo) {
        console.log(userInfo.image);
        console.log(userInfo.name);
        console.log(userInfo.score);
        document.getElementById('profile-picture').src = userInfo.image;
        document.getElementById('user-name').textContent = userInfo.name;
        document.getElementById('user-score').textContent = `Score: ${userInfo.score}`;
        document.getElementById('user-ranking').textContent = `Rank: ${userInfo.rank}`;
        document.getElementById('user-info').style.display = 'block';
    }
}

async function loadRankings() {
    const rankingBox = document.getElementById('ranking-box');
    rankingBox.innerHTML = 'Loading...';

    // Fetch rankings from the server
    const rankings = await fetchRankings(currentPage * itemsPerPage, itemsPerPage);

    rankingBox.innerHTML = '';
    rankings.forEach((ranker, index) => {
        // const rankElement = document.createElement('div');
        // rankElement.className = 'ranker';
        // rankElement.textContent = `${currentPage * itemsPerPage + index + 1}. ${ranker.name} - ${ranker.score}`;

        const rankElement = document.createElement('div');
        rankElement.className = 'ranker';

        const rank = document.createElement('div');
        rank.className = 'rank';
        rank.textContent = `${currentPage * itemsPerPage + index + 1}.`;

        const img = document.createElement('img');
        img.className = 'profile-picture';
        img.src = ranker.image;
        img.alt = `${ranker.name}'s profile picture`;

        const nameScore = document.createElement('div');
        nameScore.className = 'name-score';

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = ranker.name;

        const score = document.createElement('div');
        score.className = 'score';
        score.textContent = `Score: ${ranker.score}`;

        nameScore.appendChild(name);
        nameScore.appendChild(score);
        rankElement.appendChild(rank);
        rankElement.appendChild(img);
        rankElement.appendChild(nameScore);

        rankingBox.appendChild(rankElement);
    });
}

async function fetchRankings(start, limit) {
    // Replace with your API call to fetch rankings
    // Example data
    if (!rankings) {
        //actual data
        try {
            const response = await fetch('/get-ranking', {
                method: 'POST',
                headers: {
                    'Content-Type' : 'application/json',
                }
            });
            console.log("response from the server: " + response)
            const data = await response.json();
            if (response.ok) {
                console.log("user ranking from the server: " + JSON.stringify(data.users));
                console.log("first user's name: " + data.users[0].name)
            } else {
                console.error('Error:', data.message);
            }

            rankings = data.users.map(user => {
                return {
                    image: user.image,
                    score: user.score,
                    name: user.name
                };
            });

        } catch (error) {
            console.error('Error:', error);
        }

        console.log('loaded exampleRanking from db')
    }

    return rankings.slice(start, start + limit);
}

function nextPage() {
    if (rankings.length / itemsPerPage > currentPage + 1) {
        currentPage++;
        loadRankings();
    }
    console.log("current page: " + currentPage);
}
    

function prevPage() {
    if (currentPage > 0) {
        currentPage--;
        loadRankings();
    }
    console.log("current page: " + currentPage);
}
