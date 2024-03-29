# Format blog post as html
- convert blog post to vanilla html
- use &quot; for quotes, and &apos; for apostrophies so they don't interfere with the SQL insert code
- if you wan't to insert an image, use this:
`<div class="row">
    <div class="col-xs-12 col-md-6 col-md-offset-3">
        <img src="/img/ozark-trail-10-x-10-instant-shelter.jpg" class="img-rounded" alt="Ozark Trail 10x10 Instant Shelter" style="max-width: 100%; margin-bottom: 10px;"/>
    </div>
 </div>
 <br />`
- links off the site should open in new tabs with target="_blank", but internal links don't need to
- internal links should not include the base urls. for example, use "/blog/blog-post" instead of "https://canopytentreviews.com/blog/blog-post"
- images get added to the source code in public/img folder
- in-page images should be 798 px wide
- hero image should be 1536 x 1024 px. It's good to darken the hero because the text is white.

# Update database
- the database runs on the same VM that the website runs on. It is all in AWS lightsail
- if getting blocked when trying to connect to the DB, you may need to update AWS to whitelist the IP address you are at
- use canopy-lightsail connection in MySQL Workbench, pw = 'Canopy-123'
- add a row to the BLOGPOSTS table for your new post. the FULLPOST column expects html, all else are plaintext. Manually add the next highest rank to the RANK column.


# Test locally
### Test by running node application locally
I've updated .vscode/launch.json with a copy of all the secrets in the docker compose, so you can just hit the play button

### OR Test by running application locally in a docker container
cd \canopy-v2
docker build -t canopy-node .
docker-compose -f .\docker\docker-compose-dev.yaml up -d

# Commit code changes
- export db dump and save it in the source code in the misc folder. delete the oldest one so that you save the last 3 dumps
- update sitemap with the new blog post URL
- commit everything to git and push

# Connect to the environment
ssh -i ./misc/LightsailDefaultKey-us-east-1.pem ubuntu@canopytentreviews.com

# Take down currently running container
sudo -i
docker container ls
docker rm -f <canopy-node container id>
docker image ls
docker rmi <canopy-node image id>

# Build the new image
cd /home/ubuntu/canopy-v2
git pull --- use the new App password if it asks:
docker-compose -f ./docker/docker-compose.yaml up -d --build app