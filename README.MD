# Personal Blog
See /misc folder for additional instructions
Built to run on AWS lightsail

## Connect to the environment
ssh -i ./misc/LightsailDefaultKey-us-east-1.pem ubuntu@canopytentreviews.com

## Take down currently running container
sudo -i
docker container ls
docker rm -f <canopy-node container id>
docker image ls
docker rmi <canopy-node image id>

## Build the new image
cd /home/ubuntu/canopy-v2
git pull --- use the new App password if it asks:
docker-compose -f ./docker/docker-compose.yaml up -d --build app