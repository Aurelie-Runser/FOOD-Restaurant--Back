const express = require('express');
const sqlite3 = require('sqlite3');
const app = express();
const db = new sqlite3.Database('recettes.db');

const path = require('path');

app.use(express.json());

// Route qui renvoie les recettes
app.get('/recettes', (req, res) => {
    db.all('SELECT * FROM Recipes', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ recettes: rows });
    });
});

// Route qui renvoie les cuisines
app.get('/cuisines', (req, res) => {
    db.all('SELECT * FROM Cuisines', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ cuisines: rows });
    });
});

// Route qui renvoie les alergies
app.get('/alergies', (req, res) => {
    db.all('SELECT * FROM AllergiesInformation', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ alergies: rows });
    });
});

// Route qui renvoie les objectifs
app.get('/goals', (req, res) => {
    db.all('SELECT * FROM Goals', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ objectifs: rows });
    });
});

// Route qui renvoie les ingredients
app.get('/ingredients', (req, res) => {
    db.all('SELECT * FROM Ingredients', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ ingredients: rows });
    });
});

// Route qui renvoie les recettes en fonction de la cuisine
app.get('/recettes/cuisine_nom/:cuisine_name', (req, res) => {
    const cuisineName = req.params.cuisine_name;

    // sélectionne l'id de la cuisine en fonction de son nom
    db.get('SELECT cuisine_id FROM Cuisines WHERE name = ?', [cuisineName], (err, cuisine) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!cuisine) {
            res.status(404).json({ error: 'Cuisine non trouvée. Vérifiez son orthographe et sa syntaxe.' });
            return;
        }

        const cuisineId = cuisine.cuisine_id;

        // sélectionne toutes les recettes associées à cette cuisine
        db.all('SELECT * FROM Recipes WHERE cuisine_id = ?', [cuisineId], (err, recette) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            res.json({ "recettes": recette });
        });
    });
});

// Route qui renvoie les recettes qui n'ont pas d'allergenes
app.get('/recettes/sans_allergene', (req, res) => {
    db.all('SELECT * FROM Recipes WHERE AllergiesInformation_id IS NULL', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ "recettes sans allergènes": rows });
    });
});

// Route qui renvoie les recettes en fonction de l'objectif/goal
app.get('/recettes/goal_nom/:goal_name', (req, res) => {
    const goalName = req.params.goal_name;

    // sélectionne l'id de la cuisine en fonction de son nom
    db.get('SELECT goal_id FROM Goals WHERE name = ?', [goalName], (err, objectif) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!objectif) {
            res.status(404).json({ error: "Cette Objectif (goal) n'existe pas dans la base de données."});
            return;
        }

        const goalId = objectif.goal_id;

        // sélectionne toutes les recettes associées à cette cuisine
        db.all('SELECT * FROM Recipes WHERE goal_id = ?', [goalId], (err, recette) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            res.json({ "Les recettes avec le même objectif" : recette });
        });
    });
});

// Route qui renvoie une recette avec toutes les informations correspondantes
app.get('/recettes/all_infos/recette_titre/:recette_name', (req, res) => {
    const recetteName = req.params.recette_name;

    // récupère toutes les info sur la recette
    db.get(`SELECT
                Recipes.*,
                Cuisines.name AS NameCuisine,
                Goals.name AS NameGoal,
                DietaryInformation.name AS NameDietary,
                AllergiesInformation.name AS NameAllergie
            FROM Recipes
            INNER JOIN Cuisines ON Recipes.cuisine_id = Cuisines.cuisine_id
            INNER JOIN Goals ON Recipes.goal_id = Goals.goal_id
            INNER JOIN DietaryInformation ON Recipes.DietaryInformation_id = DietaryInformation.diet_id
            LEFT JOIN AllergiesInformation ON Recipes.AllergiesInformation_id = AllergiesInformation.allergy_id
            WHERE Recipes.title = ?`, [recetteName],
            (err, recette) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!recette) {
            res.status(404).json({ error: "La recette que vous demandez n'existe pas dans la base de données." });
            return;
        }

        const recetteId = recette.recipe_id;

        // recupère tous les ingrédients de la recette
        db.all(`SELECT * FROM RecipeIngredients WHERE recipe_id = ?`, [recetteId], (err, listeingredients) => {
            if (err) {
                console.error(err.message);
                return;
            }
        
            const ingredientPromises = listeingredients.map(recipeIngredient => {
                return new Promise((resolve, reject) => {
                    db.get(`SELECT name FROM Ingredients WHERE ingredient_id = ?`, [recipeIngredient.ingredient_id], (err, ingredient) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(ingredient);
                        }
                    });
                });
            });
        
            Promise.all(ingredientPromises)
                .then(ingredients => {
                    // récupère toutes les étapes de la recette
                    db.all(`SELECT * FROM RecipeInstructions WHERE recipe_id = ?`, [recetteId], (err, instructions) => {
                        if (err) {
                            console.error(err.message);
                            return;
                        }
        
                        res.json({ recette, ingredients, instructions });
                    });
                })
                .catch(error => {
                    console.error(error.message);
                    res.status(500).json({ error: error.message });
                });
        });
        
    });
});


// Route pour ajouter une nouvelle Cuisine
app.post('/ajouter_cuisine/cuisine_nom/:name', (req, res) => {
    // Récupérez les données de la nouvelle cuisine depuis le corps de l'url
    const { name } = req.params;

    // si 'name' est egale à null/non définit
    if (!name){
        res.status(404).json({ error: "Le nom (name) de la cuisine n'est pas définit" });
        return;
    }

    // Insérez la nouvelle cuisine dans la base de données
    db.run('INSERT INTO Cuisines (name) VALUES (?)',
        [name],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            res.json({ message: 'Nouvelle cuisine ajoutée avec succès.' });
    });
});

// Route pour ajouter un nouvel Ingredient
app.post('/ajouter_ingredient/ingredient_nom/:new_name/quantite/:new_quantity/unite/:new_unit', (req, res) => {
    const { new_name, new_quantity, new_unit } = req.params;

    if (!new_name || !new_quantity || !new_unit){
        res.status(404).json({ error: "Le nom (name) de l'ingrédient n'est pas définit" });
        return;
    }

    db.run('INSERT INTO Ingredients (name, quantity, unit) VALUES (?, ?, ?)',
        [new_name, new_quantity, new_unit],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            res.json({ message: 'Nouvel Ingrédient ajouté avec succès.' });
    });
});


// Route pour ajouter un ingrédient à une recette
app.put('/ajouter_ingredient_a_recette/recette_titre/:title_recette/ingredient_nom/:name_ingredient', (req, res) => {
    const { title_recette, name_ingredient } = req.params;

    // sélectionne l'id de la recette en fonction de son nom
    db.get('SELECT * FROM Recipes WHERE title = ?', [title_recette], (err, recette) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!recette) {
            res.status(404).json({ error: "Cette recette n'existe pas dans la base de données." });
            return;
        }

        const recetteId = recette.recipe_id;
        
        // sélectionne l'id de l'ingredient en fonction de son nom
        db.get('SELECT * FROM Ingredients WHERE name = ?', [name_ingredient], (err, ingredient) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (!ingredient) {
                res.status(404).json({ error: "Cet ingrédient n'existe pas dans la base de données." });
                return;
            }

            const ingredientId = ingredient.ingredient_id;

            // insert les données dans la table RecipeIngredients
            db.run('INSERT INTO RecipeIngredients (recipe_id, ingredient_id) VALUES (?, ?)',
                [recetteId, ingredientId],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
            
                    res.json({ message: "L'ingredient a été ajouté avec succès." });
            });
        });
    });
});

// Route pour mettre à jour le nom d’une recette
app.put('/modif_recette/title/recette_titre/:old_title/recette_nouveau_titre/:new_title', (req, res) => {
    // Récupérez les données de la nouvelle cuisine depuis le corps de l'url
    const { old_title, new_title } = req.params;

    // si 'name' est egale à null/non définit
    if (!old_title || !new_title){
        res.status(404).json("L'ancien ou le nouveau nom de la recette n'est pas définit.");
        return;
    }

    // Modifier le nom de la recette
    db.run('UPDATE Recipes SET title = ? WHERE title = ?',
        [new_title, old_title],
        (err, title) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
    
            res.json({ message: 'Le nom de la recette a été modifier avec succès.' });
    });

});

// Route pour mettre à jour la cuisine d’une recette
app.put('/modif_recette/cuisine/recette_titre/:title/recette_nouvel_cuisine/:new_cuisine', (req, res) => {
    // Récupérez les données de la nouvelle cuisine depuis le corps de l'url
    const { title, new_cuisine } = req.params;

    if (!title){
        res.status(404).json("Cette recette n'existe pas renseignée.");
        return;
    }

    db.get('SELECT * FROM Cuisines WHERE name = ?', [new_cuisine], (err, cuisine) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!cuisine){
            res.status(404).json({ error:"Cette cuisine n'existe pas dans la base de données." });
            return;
        }

        const cuisineId = cuisine.cuisine_id;

        // Modifier le nom de la recette
        db.run('UPDATE Recipes SET cuisine_id = ? WHERE title = ?',
            [cuisineId, title],
            (err, title) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                res.json({ message :"La cuisine de la recette a été modifiée avec succes" });
        });

    });
});

// Route pour mettre à jour l'alergie d’une recette
app.put('/modif_recette/allergy/recette_titre/:title/recette_nouvel_alergie/:new_allergy', (req, res) => {
    // Récupérez les données de la nouvelle cuisine depuis le corps de l'url
    const { title, new_allergy } = req.params;

    if (!title){
        res.status(404).json({ error:"Cette recette n'est pas définit." });
        return;
    }

    db.get('SELECT * FROM AllergiesInformation WHERE name = ?', [new_allergy], (err, alergie) => {
        
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // si 'title' est egale à null/non définit
        if (!alergie){
            res.status(404).json({ error:"Cet alergie n'existe pas dans la base de données." });
            return;
        }

        const allergyId = alergie.allergy_id;

        // Modifier le nom de la recette
        db.run('UPDATE Recipes SET AllergiesInformation_id = ? WHERE title = ?',
            [allergyId, title], (err, update_alergie) => {
        
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                res.json({ message:"L'alergie de la recette a été modifiée avec succès." });
        });

    });
});

// Route pour mettre à jour une etape d’une recette
app.put('/modif_recette/etape/recette_titre/:title/etape_num/:instruction_num/etape_description/:new_etape', (req, res) => {
    // Récupérez les données de la nouvelle cuisine depuis le corps de l'url
    const { title, instruction_num, new_etape } = req.params;

    if (!title || !instruction_num || !new_etape){
        res.status(404).json("La recette ou l'étape n'est pas définit.");
        return;
    }

    db.get('SELECT * FROM Recipes WHERE title = ?', [title], (err, recette) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!recette){
            res.status(404).json({ error:"Cette recette n'existe pas dans la base de données." });
            return;
        }

        const recetteId = recette.recipe_id;

        // Modifier l'instruction de la recette
        db.run('UPDATE RecipeInstructions SET description = ? WHERE step_number = ? AND recipe_id = ?',
            [new_etape, instruction_num, recetteId],
            (err, instruction) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                res.json({ message:"L'étape de la recette a été modifiée avec succès." });
        });

    });
});


// Route pour supprimer un Ingrédient à une recette
app.delete('/supp_ingredient_a_recette/recette_titre/:title_recette/ingredient_nom/:name_ingredient', (req, res) => {
    const { title_recette, name_ingredient } = req.params;

    // sélectionne l'id de la recette en fonction de son nom
    db.get('SELECT * FROM Recipes WHERE title = ?', [title_recette], (err, recette) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!recette) {
            res.status(404).json({ error:"Cette recette n'existe pas dans la base de données" });
            return;
        }

        const recetteId = recette.recipe_id;
        
        // sélectionne l'id de l'ingredient en fonction de son nom
        db.get('SELECT * FROM Ingredients WHERE name = ?', [name_ingredient], (err, ingredient) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (!ingredient) {
                res.status(404).json({ error:"Cet ingrédient n'existe pas dans la base de données" });
                return;
            }

            const ingredientId = ingredient.ingredient_id;

            // supprime les données dans la table RecipeIngredients
            db.run('DELETE FROM RecipeIngredients WHERE recipe_id = ? AND ingredient_id = ?',
                [recetteId, ingredientId],
                (err, ingredient_recette) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    if (!ingredient_recette) {
                        res.status(404).json({ error:"Cet ingrédient n'est pas utilisé dans cette recette." });
                        return;
                    }
            
                    res.json({ message: "L'ingredient a été supprimé avec succès." });
            });
        });
    });
});

// Route pour supprimer une Cuisine
app.delete('/supp_cuisine/cuisine_nom/:name', (req, res) => {
    const { name } = req.params;

    // si 'name' est egale à null/non définit
    if (!name){
        res.status(404).json("Le nom (name) de la cuisine n'est pas définit.");
        return;
    };

    db.get('SELECT * FROM Cuisines WHERE name = ?', [name], (err, cuisine) => {

        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!cuisine){
            res.status(404).json({ error:"Cette cuisine n'existe pas dans la base de données." });
            return;
        };

        const cuisineId = cuisine.cuisine_id;

        // Si la cuisine à suprrimer n'est pas "International"
        if (cuisineId != 5){
            // Met a jour toutes les recettes qui avait la cuisine qu'on veut supprimer
            db.run('UPDATE Recipes SET cuisine_id = 5 WHERE cuisine_id = ?', [cuisineId], (err, cuisine_update) => {
    
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
    
                // Supprimer la  cuisine de la base de données
                db.run('DELETE FROM Cuisines WHERE name = ?',
                    [name],
                    function (err) {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                
                        res.json({ message: 'Cuisine supprimée avec succès.' });
                });
            });
        }

        else{
            res.json({ message:"La cuisine Internationnal ne peut pas être supprimée." });
            return;
        }
    })
});


// Pour récupéré toutes les pages statique présents dans le dossier 'static'
app.use(express.static('static'));

//
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'static', '404.html'));
  });


// Lancer le serveur
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serveur lancé sur le port ${port}`);
});