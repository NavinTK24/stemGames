async function getRecipe() {
    const dish = document.getElementById("dishInput").value;
    const recipeContainer = document.getElementById("recipeContainer");

    recipeContainer.innerHTML = "Fetching recipe... 🍳";

    try {
        const res = await fetch("/get-recipe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dish })
        });

        const data = await res.json();
        recipeContainer.innerHTML = `<h2>${dish}</h2><div>${data.recipe}</div>`;
    } catch (err) {
        recipeContainer.innerHTML = "❌ Error fetching recipe!";
        console.error(err);
    }
}
