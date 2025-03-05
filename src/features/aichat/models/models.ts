export interface TextContent {
    type: "text";
    text: string;
  }
  
  //we are just gonna use base64 encoding
export interface ImageContent {
    type: "image_url";
    image_url: string;
  }
  
export interface Message {
    role: string;
    content: (TextContent | ImageContent)[] | String;
  }