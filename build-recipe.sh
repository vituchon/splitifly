# local build
tsc && go build . && docker build -f Dockerfile -t splitifly-image .
docker run --name splitifly-container -d -p 9999:9999 --security-opt seccomp=unconfined splitifly-image
# si quiero explorar docker exec -i -t splitifly-container bash

