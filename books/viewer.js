const params=new URLSearchParams(location.search);params.delete('format');location.replace('/books/reader.html?'+params.toString()+location.hash);
